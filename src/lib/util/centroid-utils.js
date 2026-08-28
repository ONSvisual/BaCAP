import bbox from '@turf/bbox';
import bboxPoly from '@turf/bbox-polygon';
import inPoly from '@turf/points-within-polygon';
// import buffer from '@turf/buffer';
// import area from '@turf/area';
import { decompressData } from "compress-csv-to-json";
// import { dissolve } from '$lib/util/bundled/mapshaper';
// import { roundAll } from '$lib/util/functions';
import { boundaries, lsoaBoundaries } from '$lib/config/geography';
import { codesToBreakDown } from '$lib/config/geography-changes';

class Centroids {
  constructor(sourceConfigs) {
    this.sourceConfigs = sourceConfigs;
    this.data = {}; // Store fetched data for each source
  }

  async initialize() {
    for (const sourceConfig of this.sourceConfigs) {
      const sourceName = sourceConfig.key;
      this.data[sourceName] = await this._fetchDataForSource(sourceConfig);
      // Process data for this source
      this._processDataForSource(sourceConfig, this.data[sourceName], sourceName);
    }

    // Set common properties based on sourceConfigs
    this.key = this.sourceConfigs[0].key; // Assume first source is primary
    // ... other common properties
  }

  async _fetchDataForSource(sourceConfig) {
    try {
      const res = await fetch(sourceConfig.url);
      if (!res.ok) {
        throw new Error(`Failed to fetch data from ${sourceConfig.url}: ${res.statusText}`);
      }
      return await res.json();
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error; // Re-throw the error to handle it at a higher level
    }

  }

  _processDataForSource(sourceConfig, data, sourceName) {
    // ... data processing logic
    const arr = decompressData(data, sourceConfig.decompressFunc)
    const key = sourceConfig.key
    this.data[sourceName].year = String(sourceConfig.year).slice(2)
    const code = `${key}${this.data[sourceName].year}cd`;

    this.data[sourceName].geojson = { type: 'FeatureCollection', features: [] };
    this.data[sourceName].lookup = {}
    this.data[sourceName].childLookup = { "E92000001": [] }

    this.data[sourceName].parents = sourceConfig.parents.map(key => {
      const code = `${key}${this.data[sourceName].year}cd`;
      return { key, code };
    });
    let parentCt = {};
    this.data[sourceName].parents.forEach(p => parentCt[p.key] = {});

    arr.forEach(d => {
      this.data[sourceName].lookup[d[code]] = d;
      this.data[sourceName].geojson.features.push({
        type: 'Feature',
        properties: { areacd: d[code] },
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      })

      this.data[sourceName].parents.forEach(p => {
        if (!parentCt[p.key][d[p.code]]) {
          parentCt[p.key][d[p.code]] = 1;
          this.data[sourceName].childLookup[d[p.code]] = [d[code]];
        } else {
          parentCt[p.key][d[p.code]] += 1;
          this.data[sourceName].childLookup[d[p.code]].push(d[code]);
        }
      })
      if (d[code][0] === "E") this.data[sourceName].childLookup["E92000001"].push(d[code]);
    })
    this.data[sourceName].parents.forEach(p => this.data[sourceName][`${p.key}_count`] = parentCt[p.key]);
  }

  // takes an array of codes and expands it to the lowest level geography specified (oa or lsoa)
  // expand(codes,geo) {
  //   return Array.isArray(codes) ?
  //     codes.map(c => this.data[geo].childLookup[c] ? this.data[geo].childLookup[c] : c).flat() :
  //     this.data[geo].childLookup[codes] ? this.data[geo].childLookup[codes] : [];
  // }
  expand(codes, geo) {
    const geoData = this.data && this.data[geo];
    if (!geoData || !geoData.childLookup) return [];

    const filterOutOAs = arr => arr.filter(v => !v.startsWith('E00') && !v.startsWith('W00'));

    function filterOutEandW(arr) {
      // need to figure out if this needs to do anything
      return arr
    }


    if (Array.isArray(codes)) {
      return codes
        .map(c => {
          const children = this.data[geo].childLookup[c]
          if (Array.isArray(children) && children.length > 0) {
            return geo === 'lsoa' ? filterOutOAs(children) : children;
          } else {
            return geo === 'lsoa' ? filterOutOAs([c]) : [c];
          }
        })
        .flat()
        .filter((d, i, a) => a.indexOf(d) === i);
    } else {
      const children = this.data[geo].childLookup[codes];
      if (Array.isArray(children) && children.length > 0) {
        return geo === 'lsoa' ? filterOutEandW(children) : children;
      } else {
        return geo === 'lsoa' ? filterOutEandW([codes]) : [codes];
      }
    }
  }



  // get a boundingbox for a list of OA codes
  bounds(oas, geo) {
    let points = {
      type: 'GeometryCollection',
      geometries: oas.map(oa => {
        let d = this.data[geo].lookup[oa];
        return {
          type: 'Point',
          coordinates: [d.lng, d.lat]
        }
      })
    };
    let bounds = bbox(points);
    bounds = [bounds[0] - 0.01, bounds[1] - 0.01, bounds[2] + 0.01, bounds[3] + 0.01];
    return bounds;
  }

  // get a boundingbox from a geometry
  boundsFromGeometry(geometry) {
    let bounds = bbox(geometry)
    bounds = [bounds[0] - 0.01, bounds[1] - 0.01, bounds[2] + 0.01, bounds[3] + 0.01];
    return bounds;
  }

  // exists(oa) {
  //   return this.lookup[oa] ? true : false;
  // }

  // Returns OA codes within the coordinates of a Polygon/MultiPolygon
  contains(geo) {
    let bounds = bbox(geo);
    bounds = bboxPoly(bounds);

    let oas = inPoly(this.data['oa'].geojson, bounds);
    oas = inPoly(oas, geo).features.map(oa => oa.properties[boundaries.idKey]);
    let lsoas = inPoly(this.data['lsoa'].geojson, bounds);
    lsoas = inPoly(lsoas, geo).features.map(lsoa => lsoa.properties[lsoaBoundaries.idKey]);

    return { bbox: bounds, oa: new Set(oas), lsoa: new Set(lsoas) };
  }

  // compresses an array codes to the highest geography level specified (oa or lsoa). Although doesn't work if you set it compress to lsoa, as it skips out lsoa and just gives back MSOAs or higher
  compress(codes, geo) {
    let all = {};
    let compressed = [];
    all[geo] = codes;//this contains all the area codes for the specified geography

    this.data[geo].parents.forEach(p => {
      all[p.key] = codes.map(area => this.data[geo].lookup[area][p.code]);
    });//for all the parents geography levels, add the parents codes at that level to each area code
    // this means that often codes are repeated


    const keys = Object.keys(all).reverse(); // go through from highest to lowest geography level
    for (let i = 0; i < codes.length; i++) { // go through all the codes
      if (this.data[geo].parents.every(p => !compressed.includes(all[p.key][i]))) { //if compressed does not include the ith code at that parent level, continue
        for (let j = 0; j < keys.length; j++) {
          let thiskey = keys[j];
          if (j === keys.length - 1) {
            compressed.push(all[thiskey][i]);
          } else if (
            (all[thiskey].filter(cd => all[thiskey][i] === cd)).length ===
            this.data[geo][`${thiskey}_count`][all[thiskey][i]]
          ) {
            compressed.push(all[thiskey][i]);
            break;
          }
        }
      }
    }
    return compressed;
  }

  identifyHighestGeography(codeList, compareList = null) {
    const pattern = /[EW]0([0-7])\d{5}/i;  // Case-insensitive matching
    const compareSet = Array.isArray(compareList)
      ? new Set(compareList.map(code => String(code).toUpperCase()))
      : null;
    let highestLevel = null;

    for (const code of codeList) {
      const match = code.match(pattern);
      if (match) {
        const level = parseInt(match[1]);
        if (level === 1 && compareSet && !compareSet.has(String(code).toUpperCase())) { //this checks that an LSOA appears in both the selected and the compressed OA list
          continue;
        }
        if (highestLevel === null || level > highestLevel) {  // Changed < to > to find highest
          highestLevel = level;
        }
      }
    }

    if (highestLevel !== null) {
      switch (highestLevel) {
        case 0: return "oa";
        case 1: return "lsoa";
        case 2: return "msoa";
        case 6:
        case 7: return "ltla";
      }
    }

    return "No valid geography codes found";
  }

  getChildrenMsoas(code) {
    return this.data['lsoa'].childLookup[code];
  }

  // replaces specific codes for LAs with their children MSOA codes
  replaceCodesWithMSOA(codes) {
    let updatedCodes = [...codes]; // Create a copy to avoid modifying the original array

    // Break down codes authorities into children MSOAs
    let finalCodes = [];
    for (const code of updatedCodes) {
      if (codesToBreakDown.includes(code)) {
        const msoas = this.getChildrenMsoas(code);

        if (msoas) {
          finalCodes.push(...msoas);
        } else {
          // Handle case where childLookup doesn't have the code
          console.warn(`Warning: Could not find children MSOAs for LA code: ${code}`);
          finalCodes.push(code); // Or decide to exclude it
        }
      } else {
        finalCodes.push(code);
      }
    }
    return finalCodes;
  }

  async simplify(
    name = '',
    selected,
    mapObject
  ) {
    // console.log(selected)
    const oa_all = Array.from(selected['oa']);
    const lsoa_all = Array.from(selected['lsoa']);
    // compress the codes
    const compressed = this.compress(oa_all, 'oa');
    // compress LSOA list
    const compressedLsoa = this.compress(lsoa_all, 'lsoa')
    const bbox = this.bounds(oa_all, 'oa');
    const highestLevel = this.identifyHighestGeography(this.compress(oa_all, 'oa'),this.compress(lsoa_all,'lsoa'))
    var merge = {};
    merge.properties = {
      name,
      // bbox,
      compressed,
      compressedLsoa,
      highestLevel,
      oa_all,
      lsoa_all,
      original: oa_all.length,
    };
    /// geo

    // move map to selection
    mapObject.fitBounds(bbox, { padding: 0, animate: false });

    merge.geojson = selected.geo

    return merge;
  }

  ////////////////////////
  // generic function defs
  ////////////////////////
  getbbox(coords) {
    var lat = coords.map(p => +p[1]);
    var lng = coords.map(p => +p[0]);

    var minCoords = [Math.min.apply(null, lng), Math.min.apply(null, lat)];
    var maxCoords = [Math.max.apply(null, lng), Math.max.apply(null, lat)];

    return [minCoords, maxCoords];
  }

  population(oa) {
    return this.data['oa'].lookup[oa].population;
  }
}

// asynchronous factory function
export async function GetCentroids(sourceConfigs) {
  const c = new Centroids(sourceConfigs);
  await c.initialize();
  return c;
}
