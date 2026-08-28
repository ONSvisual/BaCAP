
<script>
  import { onMount } from "svelte";
  import pym from "pym.js";
  import html2canvas from "html2canvas";
  import topics from "$lib/config/topics.json";
  import Cards from "$lib/layout/Cards.svelte";
  import Card from "$lib/layout/Card.svelte";
  import BarChart from "$lib/charts/BarChart.svelte";
  import AreaMap from "$lib/charts/AreaMap.svelte";
  import ProfileChart from "$lib/charts/ProfileChart.svelte";
  import BigNumber from "$lib/charts/BigNumber.svelte";
  import LineChart from "$lib/charts/LineChart.svelte";
  import {
    isDatasetAvailableInVersion,
    getDatasetForVersion,
  } from "$lib/util/topic-functions";

  let pymChild,
    name,
    comp,
    geojson,
    compGeojson,
    tables,
    population,
    showMapInProfile,
    version;
  let stats = [];
  let hideTables = false;

  let topicsLookup = {};
  function makeTopicsLookup() {
    topics
      .filter((d) => isDatasetAvailableInVersion(d, version))
      .map((d) => getDatasetForVersion(d, version))
      .forEach((t) => (topicsLookup[t.code] = t));
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function expandTable(table, areaName, compName) {
    let def = topicsLookup[table.code];
    let data = [];
    let i = 0;
    let names =
      table.data.length === def.categories.length
        ? [areaName]
        : [areaName, compName];
    names.forEach((name) => {
      def.categories.forEach((cat) => {
        data.push({
          areanm: name,
          category: cat.label,
          value:
            version == 1
              ? table.data[i]
              : def.code === "resident_age"
                ? table.data[i].percentage
                : table.data[i].value,
        });
        i++;
      });
    });
    return data;
  }

  function update() {
    let hash = document.location.hash;
    if (hash && hash.includes("name=")) {
      let props = {};
      let searchParams = new URLSearchParams(hash.slice(3));
      for (let pair of searchParams.entries()) {
        if (["name", "comp", "showMap", "version"].includes(pair[0])) {
          props[pair[0]] = atob(pair[1]);
        } else if (
          ["tabs", "poly", "comppoly", "population", "stats"].includes(pair[0])
        ) {
          props[pair[0]] = JSON.parse(atob(pair[1]));
        }
      }
      name = props.name || "Selected area";
      comp = props.comp || "";
      geojson = props.poly;
      version = props.version || 1;
      showMapInProfile = props.showMap;
      compGeojson = props.comppoly;
      population = props.population;
      tables = props.tabs.map(t => ({...t, data: t.data.filter(d => d.value >= 0)}));
      stats = props.stats;
      makeTopicsLookup();
    }
  }

  async function makePNG(e) {
    hideTables = true;
    await sleep(1000)
    let canvas = await html2canvas(document.body, {
      useCORS: true,
    });
    const base64 = canvas.toDataURL();
    let a = document.createElement("a");
    a.href = base64;
    a.download = name.replace(/\s+/g, "_") + ".png";
    a.click();
    hideTables = false;
  }

  onMount(() => {
    pymChild = new pym.Child({ id: "embed", polling: 1000 });
    pymChild.onMessage("makePNG", makePNG);
    update();
  });

  $: console.log(tables);
</script>

<svelte:window on:hashchange={update} />

<svelte:head>
  <title>Area profile{name ? ` for ${name}` : ""}</title>
  <meta name="googlebot" content="noindex,indexifembedded" />
</svelte:head>

{#if tables}
  {#if name && name !== "Selected area" && name !== "undefined"}
    <h1 class="ons-u-mt-s ons-u-mb-s">{name}</h1>
  {/if}
  <Cards>
    {#if geojson && showMapInProfile}
      <Card title="Area map">
        <AreaMap {name} {comp} {geojson} {compGeojson} />
      </Card>
    {/if}
    {#each tables || [] as tab}
      {#if version >= 2}
        <Card
          title={topicsLookup[tab.code].label}
          source={topicsLookup[tab.code].source}
          geography={topicsLookup[tab.code].lowestGeography}
          timeperiod={topicsLookup[tab.code].dateLabel
            ? topicsLookup[tab.code].dateLabel
            : "2021"}
        >
          <!-- use new version -->
          {#if topicsLookup[tab.code]?.chart === "number"}
          {@const isPercentage = topicsLookup[tab.code].unit==='%'}
            {#if tab.data.length < 1}
              <p>No data available</p>
            {:else if tab.data.length < 2}
              <BigNumber
                value={tab.data[0].count}
                unit={isPercentage ? `of ${topicsLookup[tab.code].base}` : topicsLookup[tab.code].unit}
                prefix={topicsLookup[tab.code].prefix}
                suffix={isPercentage ? '%' : null}
                rounded={!topicsLookup[tab.code]?.roundCount
                  ? null
                  : tab.data[0].count > 1000
                    ? `Rounded to the nearest 100 ${topicsLookup[tab.code].unit}`
                    : tab.data[0].count > 100
                      ? `Rounded to the nearest 10 ${topicsLookup[tab.code].unit}`
                      : `Rounded to the nearest 10 ${topicsLookup[tab.code].unit}`}
              />
            {:else}
              <BigNumber
                value={tab.data[0].count}
                unit={isPercentage ? `of ${topicsLookup[tab.code].base}` : topicsLookup[tab.code].unit}
                prefix={topicsLookup[tab.code].prefix}
                suffix={isPercentage ? '%' : null}
                description={comp && isPercentage
                  ? `<mark>${tab.data[1].count.toFixed(1)}%</mark> in ${comp}`
                  : comp 
                    ? `<mark>${tab.data[1].count.toLocaleString("en-GB")}</mark> ${topicsLookup[tab.code].unit} in ${comp}`
                    : ""}
                rounded={!topicsLookup[tab.code]?.roundCount
                  ? null
                  : tab.data[0].count > 1000
                    ? `Rounded to the nearest 100 ${topicsLookup[tab.code].unit}`
                    : tab.data[0].count > 100
                      ? `Rounded to the nearest 10 ${topicsLookup[tab.code].unit}`
                      : `Rounded to the nearest 10 ${topicsLookup[tab.code].unit}`}
              />
            {/if}
          {:else if topicsLookup[tab.code]?.chart === "profile"}
            <ProfileChart
              xKey="category"
              yKey="value"
              zKey="areanm"
              data={expandTable(tab, name, comp)}
              base="% of {topicsLookup[tab.code].base}"
              table={!hideTables}
            />
          {:else if topicsLookup[tab.code]?.chart === "line"}
            <LineChart
              data={expandTable(tab, name, comp)}
              zKey="areanm"
              xDomain={topicsLookup[tab.code].categories.map((c) => c.label)}
              base="% change since {topicsLookup[tab.code].categories[0].label}"
            />
          {:else}
            <BarChart
              xKey="value"
              yKey="category"
              zKey="areanm"
              data={expandTable(tab, name, comp)}
              base="% of {topicsLookup[tab.code].base}"
              table={!hideTables}
            />
          {/if}
        </Card>
      {:else}
        <Card title={topicsLookup[tab.code].label}>
          <!-- Use old version -->
          {#if topicsLookup[tab.code]?.chart === "number"}
            <BigNumber
              value={tab.data[0]}
              unit={topicsLookup[tab.code].unit}
              prefix={topicsLookup[tab.code].prefix}
              description={comp
                ? `<mark>${tab.data[1].toLocaleString("en-GB")}</mark> ${topicsLookup[tab.code].unit} in ${comp}`
                : ""}
              rounded={tab.data[0] > 1000
                ? `Rounded to the nearest 100 ${topicsLookup[tab.code].unit}`
                : tab.data[0] > 100
                  ? `Rounded to the nearest 10 ${topicsLookup[tab.code].unit}`
                  : null}
            />
          {:else if topicsLookup[tab.code]?.chart === "profile"}
            <ProfileChart
              xKey="category"
              yKey="value"
              zKey="areanm"
              data={expandTable(tab, name, comp)}
              base="% of {topicsLookup[tab.code].base}"
              table={!hideTables}
            />
          {:else}
            <BarChart
              xKey="value"
              yKey="category"
              zKey="areanm"
              data={expandTable(tab, name, comp)}
              base="% of {topicsLookup[tab.code].base}"
              table={!hideTables}
            />
          {/if}
        </Card>
      {/if}
    {/each}
  </Cards>
  {#if version == 1}
    <span class="footnote"
      >Source: Office for National Statistics - Census 2021</span
    >
  {/if}
  <div class="spacer" />
{/if}

<style>
  h1 {
    font-size: 1.8rem;
    margin: 0 0 -12px 0;
    font-weight: bold;
  }
  /* h3 {
    font-size: 1.3rem;
    font-weight: bold;
  } */
  div.spacer {
    height: 10px;
  }
</style>
