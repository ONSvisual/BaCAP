import {
  mapObject,
  centroids,
  selected,
  state,
  version,
} from "$lib/stores/mapstore";
import { get } from "svelte/store";
import { csvFormat, csvFormatRows } from "d3-dsv";
import { buildstate, tables } from "$lib/stores/mapstore";
import { analyticsEvent } from "@onsvisual/svelte-components";
import { download, clip } from "$lib/util/functions";
import { cdnbase } from "$lib/config/geography";
import topicsAll from "$lib/config/topics.json";
import getTable from "$lib/util/get-table";
import { goto } from "$app/navigation";
import { base } from "$app/paths";
import {
  isDatasetAvailableInVersion,
  getDatasetForVersion,
} from "$lib/util/topic-functions";

const topicsLookup = Object.fromEntries(topicsAll.map((d) => [d.code, d]));

export function filterTopics(allTopics, level, coverage) {
  return allTopics
    .filter((d) => isDatasetAvailableInVersion(d, get(version)))
    .map((d) => getDatasetForVersion(d, get(version)))
    .filter(geographyFilter(level))
    .filter(
      (t) => !t.coverage || coverage.every((c) => t.coverage.includes(c)),
    );
}

export function updateLocalStorage(store) {
  // let ls = JSON.parse(localStorage.getItem("onsbuild"));
  if (store) {
    // ls.properties.name = name;
    localStorage.setItem("onsbuild", JSON.stringify(store));
  } else {
    return;
  }
}

let cache = {}; // this is the same if the area changes, so need to make a unique cache for each area somehow

export async function getData(topic, comparison) {
  const compressedSelectionCodes = [
    ...new Set([
      ...get(buildstate).compressed.oa,
      ...get(buildstate).compressed.lsoa,
    ]),
  ].join("");
  const comparisonCodes = [
    ...new Set([
      ...(comparison?.codes?.oa ?? []),
      ...(comparison?.codes?.lsoa ?? []),
    ]),
  ].join("");

  const combinedCodesString = compressedSelectionCodes + comparisonCodes;

  cache[combinedCodesString] ||= {}; // Only create a new object if it doesn't exist
  let cacheForArea = cache[combinedCodesString];

  if (!get(buildstate).start) return [];

  cacheForArea[combinedCodesString] ||= {};

  let tables = await Promise.all(
    topic.map(async (d) => {
      if (!cacheForArea[combinedCodesString][d.code]) {
        cacheForArea[combinedCodesString][d.code] = await getTable(
          d,
          get(buildstate),
          comparison?.codes,
        );
      }
      return { code: d.code, data: cacheForArea[combinedCodesString][d.code] };
    }),
  );

  return tables;
}

export function groupTopics(topics) {
  return topics.reduce((acc, item) => {
    if (!acc[item.topic]) acc[item.topic] = [];
    acc[item.topic].push(item);
    return acc;
  }, {});
}

export async function checkForHashSelection() {
  let hash = window.location.hash;
  if (hash.match(/#[EKNSW]\d{8}/)) {
    let code = hash.slice(1);
    try {
      const info = await getAreaData(code);
      localStorage.setItem("onsbuild", JSON.stringify(info));
      analyticsEvent({
        event: "hashSelect",
        areaCode: code,
        areaName: info.properties.name,
      });
      if (info.properties.compressed.length == 0) {
        alert(
          "This area is too small to provide best-fit data! Redirecting to the drawing page...",
        );
        goto(`${base}/draw/${hash}`);
        return;
      }
    } catch (err) {
      console.error("Error fetching or processing data:", err);
      history.replaceState(null, "", " ");
    }
  }
}

export async function getAreaData(code, options = {}) {
  const res = await fetch(`${cdnbase}/${code.slice(0, 3)}/${code}.json`);
  const data = await res.json();
  const compressed = data.properties.oa21cds || [];
  const compressedLsoa = data.properties.lsoa21cds || [];

  return {
    geojson: data,
    properties: {
      oa_all: !options?.comparison
        ? get(centroids).expand(compressed, "oa")
        : null,
      compressed,
      compressedLsoa,
      name: data.properties.hclnm
        ? data.properties.hclnm
        : data.properties.areanm
          ? data.properties.areanm
          : code,
      highestLevel: compressedLsoa.length ? "lsoa" : compressed.length ? "oa" : null,
    },
  };
}

export function getName() {
  let name = get(buildstate).name ? get(buildstate).name : "Custom Area";
  return name[0].toUpperCase() + name.slice(1);
}

function makeTable(data, meta, name, compName) {
  const rows = [];
  const isSingle = meta.categories.length === 1;
  const isTimeseries = meta.chart === "line";

  for (let i = 0; i < meta.categories.length; i++) {
    const cat = meta.categories[i];
    const value = data.filter((d) => d.areanm === "MyCustomArea")[i];
    const compValue = compName
      ? data.filter((d) => d.areanm === "ComparisonArea")[i]
      : null;

    const row = {
      Variable: meta.label,
      Category: isTimeseries ? meta.label.replace(" timeseries", "") : meta.categories.length === 1 ? meta.label : cat.label,
      [`${name} (count)`]: value.count,
      ...(compValue ? { [`${compName} (count)`]: compValue.count } : {}),
      [`${name} (%)`]: !isSingle ? value.percentage : null,
      ...(compValue
        ? { [`${compName} (%)`]: !isSingle ? compValue.percentage : null }
        : {}),
      Unit: isSingle ? meta.unit : meta.base.replace("all ", ""),
      "Base population": meta.base,
      Source: meta.source,
      Geography: meta.lowestGeography === "lsoa" ? "LSOA" : "Output Area",
      "Time period": isTimeseries ? cat.label : meta.dateLabel || "2021",
    };
    rows.push(row);
  }
  return rows;
}

export async function downloadData() {
  const bs = get(buildstate);

  const header = [
    `Custom area profile data for ${getName()}`,
    "Source: Office for National Statistics",
    "",
    `Data generated by the ONS Build a Custom Area Profile tool on ${new Date().toLocaleDateString(
      "en-GB",
      { year: "numeric", month: "short", day: "numeric" },
    )}`,
    "The data in this profile are aggregated from small areas on a best-fit basis, and therefore may differ slightly from other sources.",
  ];

  const data = [];
  get(tables).forEach((t) => {
    let meta = topicsLookup[t.code];
    data.push(
      ...makeTable(t.data, meta, getName(), bs.comparison?.areanm || null),
    );
  });
  const csv = csvFormatRows(header.map((d) => [d])) + "\n\n" + csvFormat(data);

  var file = new Blob([csv], { type: "text/csv" });
  download(
    file,
    `${bs.name ? bs.name.replaceAll(" ", "_") : "custom_area"}.csv`,
  );
  let opts = bs.name ? { areaName: bs.name } : {};
  analyticsEvent({ event: "fileDownload", fileExtension: "csv", ...opts });
}

// Define geography levels from lowest to highest
export const GEOGRAPHY_LEVELS = ["oa", "lsoa", "msoa", "ltla"];

export const geographyLookup = {
  oa: "Output area",
  lsoa: "LSOA",
  msoa: "MSOA",
  ltla: "LTLA",
};

export function makeEmbed(embedHash) {
  let url = `https://www.ons.gov.uk/visualisations/customprofiles/embed/${embedHash}`;
  return `<div id="custom-profile"></div>
    <script src="https://cdn.ons.gov.uk/vendor/pym/1.3.2/pym.min.js"><\/script>
    <script>var pymParent = new pym.Parent("custom-profile", "${url}", {name: "custom-profile", title: "Embedded area profile"});<\/script>`;
}

export function savePNG(pymParent) {
  pymParent.sendMessage("makePNG", null);
  let opts = get(buildstate).name ? { areaName: get(buildstate).name } : {};
  analyticsEvent({
    event: "fileDownload",
    fileExtension: "png",
    ...opts,
  });
}

export function copyEmbed(embedHash) {
  clip(makeEmbed(embedHash));
  let opts = get(buildstate).name ? { areaName: get(buildstate).name } : {};
  analyticsEvent({ event: "embed", ...opts });
}

// export function showEmbed() {

// buildstate.update((s) => ({ ...s, showEmbed: !s.showEmbed }));

// setTimeout(() => {
//   const el = document.querySelector("textarea");
//   if (!el) return;

//   el.scrollIntoView({
//     behavior: "smooth",
//   });
// });
// }

// Creates a lowest available geography filter function for use in a filter chain
export function geographyFilter(selectedGeography) {
  const selectedLevel = GEOGRAPHY_LEVELS.indexOf(
    selectedGeography.toLowerCase(),
  );

  // Return a filter function
  return (topic) => {
    // If selected level is lsoa or higher, keep all topics. this is hardcoded
    if (selectedLevel >= GEOGRAPHY_LEVELS.indexOf("lsoa")) {
      return true;
    }
    // For oa, only keep topics with lowestGeography === 'oa'
    return topic.lowestGeography?.toLowerCase() === "oa";
  };
}

export function handleDatasetsShowAllClick() {
  buildstate.update((currentValue) => ({
    ...currentValue,
    showAllDatasets: !currentValue.showAllDatasets,
  }));
}

export function loadGeo(uploader) {
  return new Promise((resolve) => {
    let file = uploader.files[0] ? uploader.files[0] : null;

    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          // Read + simplify the boundary
          let b = JSON.parse(e.target.result);

          if (b.type == "FeatureCollection") {
            b = b.features[0];
          } else if (b.type == "Geometry") {
            b = { type: "Feature", geometry: b };
          }
          if (!b.properties) b.properties = {};

          // if (!b?.properties?.codes_compressed && b?.geometry) {
          //   if (JSON.stringify(b.geometry).length > 10000)
          //     b.geometry = simplifyGeo(b.geometry, 10000);
          //   const oas = $centroids.contains(b);
          //   b.properties.codes_compressed = $centroids.compress(
          //     [...oas.oa],
          //     "oa",
          //   );
          //   b.properties.codes_compressed_to_lsoa = $centroids.compress(
          //     [...oas.lsoa],
          //     "lsoa",
          //   );
          // }
          if (!b?.properties?.codes_compressed) {
            alert("Please upload a valid GeoJSON file.");
            resolve(null);
          }

          if (b) {
            const props = b.properties;
            const comparison = {
              type: "place",
              areanm:
                props.areanm || props.name || props.areacd || "Comparison Area",
              areacd: b.properties.areacd || null,
              group: "Uploaded area",
              geometry: b.geometry,
              oa21cds: b.properties.codes_compressed || [],
              lsoa21cds: b.properties.codes_compressed_to_lsoa || [],
            };
            console.log({ comparison });
            // analyticsEvent({
            //   event: "geoUpload",
            //   areaName: state.comparison.areanm,
            // });
            resolve(comparison);
          } else {
            alert("Please upload a valid GeoJSON file.");
            resolve(null);
          }
        } catch(err) {
          console.log(err);
          alert("Error. Please upload a valid GeoJSON file.");
          resolve(null);
        }
      };
      reader.readAsText(file);
    }
  });
}
