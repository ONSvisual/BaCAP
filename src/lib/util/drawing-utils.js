import { get } from 'svelte/store';
import {
  mapObject,
  radiusInKm,
  drawType,
  selected,
  addMode,
  drawEnabled,
  centroids,
  user_geometry
} from '$lib/stores/mapstore';
import { boundaries } from '$lib/config/geography';
import { roundAll, extent, union, difference } from '$lib/util/functions';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
// import {bboxToTile} from '@mapbox/tilebelt';
import circle from '@turf/circle';
import turfSimplify from '@turf/simplify';
import buffer from '@turf/buffer';
import turfArea from '@turf/area';
// import turfBBOX from '@turf/bbox';
// import turfInPolygon from '@turf/boolean-point-in-polygon';
import { dissolve } from '$lib/util/bundled/mapshaper';
import bbox from '@turf/bbox';
import turfunion from '@turf/union';
import turfdifference from '@turf/difference';
import {featureCollection} from '@turf/helpers';

const mzm = 10;
const blank = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [],
  },
}

export var Draw;
export let coordinates = [];
// keep track of coordinates of centre of radius drawing tool
let radiusCenter = null;

////////////////////
///////////////////

function cursor() {
  // A function to change the df.loc({rows:df.$index.slice(0,4)})ap cursor
  const de = get(drawEnabled);
  const dt = get(drawType);

  // if (de | dt === undefined ){document.querySelector('#mapcontainer div canvas').style.cursor = 'no-drop';}
  let canvas = document.querySelector('#mapcontainer div canvas');
  if (canvas) {
    switch (dt) {
      case 'select':
        canvas.style.cursor = 'auto';
        break;
      case 'polygon':
        canvas.style.cursor = 'crosshair';
        break;
      case 'radius':
        canvas.style.cursor = 'crosshair';
        break;
      default:
        canvas.style.cursor = 'grab';
    }
  }
}

export async function initDraw() {
  const map = get(mapObject);

   //map stuff for user generated area
   map.addSource ('userGeo', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [],
      },
    },
  });

  map.addLayer ({
    id: 'userGeo_layer',
    type: 'fill',
    source: 'userGeo',
    paint: {
      'fill-color': '#1f8ab0',
      'fill-outline-color': '#1f8ab0',
      'fill-opacity': 0.2,
    },
  });

  map.addLayer ({
    id: 'userGeo_outline',
    type: 'line',
    source: 'userGeo',
    layout: {'line-cap': 'round', 'line-join': 'round'},
    paint: {
      'line-color': '#1f8ab0',
      // 'line-dasharray': [0.2, 2],
      'line-width': 2.5,
    },
  });

  //map stuff for drawing
  map.addSource('drawsrc', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [],
      },
    },
  });

  map.addLayer({
    id: 'draw_layer',
    type: 'fill',
    source: 'drawsrc',
    paint: {
      'fill-color': '#fbb03b',
      'fill-outline-color': '#fbb03b',
      'fill-opacity': 0.1,
    },
  });

  map.addLayer({
    id: 'draw_outline',
    type: 'line',
    source: 'drawsrc',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#fbb03b',
      'line-dasharray': [0.2, 2],
      'line-width': 2,
    },
  });

  Draw = new MapboxDraw({
    draw: ['draw_polygon'],
    displayControlsDefault: false,
    controls: {
      polygon: false,
      trash: false,
    },
    userProperties: true,
  });

  map.addControl(Draw);
  map.on('draw.selectionchange', drawPoly);
  Draw.deleteAll();
  async function drawPoly(e) {
    var data = Draw.getAll();
    var geo = await data.features[0];
    update(geo);
    clearDraw();
  }
  map.on('zoomend', function () {
    const de = map.getZoom() < mzm;
    drawEnabled.set(de);
    // cursor()
  });

  map.doubleClickZoom.enable();
  // on move events
  map.on('mousemove', function move(e) {
    // console.log (e.lngLat, get (drawType));

    if (get(drawType) == 'radius') circleFast(false, e.lngLat);
  });

  // clear coordinates each time we change
  drawType.subscribe(dt => {
    coordinates = [];
    // addMode.set(true);
    circleFast((clear = get(drawType) != 'radius'));
    Draw.deleteAll();
    cursor();
    if (dt === 'polygon') {
      Draw.changeMode('draw_polygon', {});
    }
  });

  // set default
  radiusCenter = null;
  circleFast((clear = true));
  drawType.set('move');

  // update circle tool each radius change
  radiusInKm.subscribe(() => circleFast());

  function boundClick(e) {
    switch (get(drawType)) {
      case 'radius':
        drawRadius(e.lngLat);
        break;
      case 'select':
        drawPoint(e);
        break;
    }
  }
  map.on('click', boundClick); //mouse
  map.on('touchstart', boundClick); //touch

  // let hovered;

  // function boundHover(e) {
  //   if (hovered) map.removeFeatureState(
  //     { source: "area", sourceLayer: boundaries.layer, id: hovered },
  //   );
  //   if (e.features?.[0] && get(drawType) === "select") {
  //     hovered = e.features[0].properties[boundaries.idKey];
  //     map.setFeatureState(
  //       { source: "area", sourceLayer: boundaries.layer, id: hovered },
  //       { hovered: true }
  //     );
  //   } else {
  //     hovered = null;
  //   }
  // }
  // map.on('mousemove', 'bounds', boundHover); //hover
}

export function simplifyGeo(geometry, maxLength = 5000) {
  // Simplifies a geojson geometry
  let simple = buffer(geometry, 0).geometry; // Fix invalid geometries
  let length = JSON.stringify(simple).length;
  let precision = 5;

  while (length > maxLength && precision >= 2) {
    if (simple.type === "MultiPolygon") {
    const area = turfArea(simple)
        simple.coordinates = simple.coordinates.filter(d => turfArea({type: 'Polygon', coordinates: d}) > area * Math.min(Math.pow(10, -precision), 0.01))
    }
    try {
        simple = turfSimplify(simple, {
            highQuality: true,
            tolerance: Math.pow(10, -precision),
        });
        simple.coordinates = roundAll(simple.coordinates, Math.ceil(precision));
        length = JSON.stringify(simple).length;
        precision -= 0.5;
    } catch(err) {
        console.warn(err);
        break;
    }
  }
  return simple;
}

function makeBoundary(geojson, simplify = false) {
  let dissolved = dissolve(geojson);

  let simple;
  if (simplify) {
    simple = simplifyGeo(dissolved.geometry);
  } else {
    simple = dissolved.geometry;
    simple.coordinates = roundAll(simple.coordinates, 6);
  }

  return { type: 'Feature', geometry: simple };
}

function clear() { //clears the drawing layers
  coordinates = [];
  changeData('drawLayer', blank);
}

export function clearGeo(){ //resets the user generated geometry
  changeData('userGeo', blank);
  user_geometry.set(blank)
}

export function clearDraw() {
  Draw.deleteAll();
  Draw.changeMode('draw_polygon', {});
}

export function changeData(layer, data) {
  const map = get(mapObject);
  if (map) map.getSource(layer).setData(data);
}

////////////////////
// Matching Utilities
////////////////////

export async function update(geo) {
  // update all polygon like draw items
  document.querySelector('#mapcontainer div canvas').style.cursor = 'wait';
  if(is_geo_empty(get(user_geometry))){ //check if there's an existing geometry in the store
    if(get(addMode)){
      changeData('userGeo',geo) // change the layer with the user drawn geometry
      user_geometry.set(geo) // store it to the store
    }
  }else{
    let union = addOrSubtractGeo(await get(user_geometry),geo) //if there's something there check it intersect and make a union
    if(union==null){union = blank} //if the union is null, set it to blank
    changeData ('userGeo',union) //update map
    user_geometry.set(union) //update store
  }

  const features = await get(centroids).contains(geo);

  var current = get(selected);
  var last = current[current.length - 1];
  
  if (get(addMode)) {
    current.push({
      lsoa: union(last.lsoa, new Set(features.lsoa)),
      oa: union(last.oa, new Set(features.oa)),
      geo:await(get(user_geometry))
    });
  } else {
    current.push({
      lsoa: difference(last.lsoa, new Set(features.lsoa)),
      oa: difference(last.oa, new Set(features.oa)),
      geo:await(get(user_geometry))
    });
  }
  updateLocal(current);
  cursor();

}

// function drawPoint(e) {
//   // update using select tool
//   let feature = e.features[0];
//   if (feature) {
//     let code = feature.properties[boundaries.idKey];
//     let parentcd = feature.properties[boundaries.ptKey];
//     let current = get(selected);
//     let oas = current[current.length - 1].oa;
//     if (oas.has(code) && parentcd) {
//       oas = difference(oas, new Set(get(centroids).expand([parentcd])));
//     } else if (oas.has(code)) {
//       oas = difference(oas, new Set([code]));
//     } else if (parentcd) {
//       oas = union(oas, new Set(get(centroids).expand([parentcd])));
//     } else {
//       oas = new Set([...oas, code]);
//     }
//     current.push({ oa: oas, boundary:'geometry' });
//     updateLocal(current);
//   }
// }

function updateLocal(current) {
  // limit our undo list to 20
  if (current.length >= 20) current = current.slice(current.length - 20, current.length);

  selected.set(current);
  var items = current[current.length - 1];
  // we cannot stringify sets!
  items = JSON.stringify(
    items,
    (_key, value) => (value instanceof Set ? [...value] : value)
  );
  localStorage.setItem('draw_data', items);
}

////////////////////
// Circle Tools
////////////////////

function drawRadius(center, points = 24) {
  const options = { steps: points, units: 'kilometers' };
  let geo = circle([center.lng, center.lat], +get(radiusInKm), options);

  update(geo);
}

/// Fast Circle on-move Function
function circleFast(clear = false, center = radiusCenter) {
  let geo;
  if (center && !clear) {
    const options = { steps: 24, units: 'kilometers' };
    geo = circle([center.lng, center.lat], +get(radiusInKm), options);
  } else {
    geo = { type: 'Polygon', coordinates: [] };
  }
  changeData('drawsrc', geo);
  return geo;
}

////////////////////
// Query
////////////////////

function is_geo_empty(feature){
  if (!feature || !feature.geometry || !feature.geometry.coordinates ) {
    return true; // Handle cases where geometry or coordinates are missing
  }
  return feature.geometry.coordinates.length === 0;
}

function addOrSubtractGeo(geojson1,geojson2){
  if(get(addMode)){
    return turfunion(featureCollection([geojson1, geojson2]));
  }else{
    return turfdifference(featureCollection([geojson1,geojson2]))
  }
}

export function geoBlob(q) {
  const geojson = q.geojson;
  geojson.properties = {
    name: q.properties.name,
    bbox: bbox(geojson),
    codes: q.properties.oa_all,
    codes_compressed: q.properties.compressed,
    codes_compressed_to_lsoa:q.properties.compressedLsoa// add compressed to LSOA and above
  };
  return new Blob([JSON.stringify(geojson)], {
    type: 'application/json',
  });
}
