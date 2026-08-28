<script>
    import { scaleLinear, scalePoint } from "d3-scale";

    export let data;
    export let yKey = (xKey) => `${xKey}_change`;
    export let zKey = "areanm";
    export let height = 120;
    export let lineWidth = 2;
    export let xDomain = [1981, 1991, 2001, 2011];
    export let xVal = xDomain[xDomain.length - 1];
    export let base = "";
    export let formatTick = (tick) =>
        `${tick - 1 > 0 ? "+" : ""}${((tick - 1) * 100).toFixed(1)}`;

    let _data, yDomain, zDomain, xScale, yScale;
    let loaded = false;

    function transformData(data) {
        let indexed = {};
        data.forEach((d) => {
            if (!indexed[d[zKey]]) {
                indexed[d[zKey]] = {};
                indexed[d[zKey]][zKey] = d[zKey];
            }
            indexed[d[zKey]][d.category] = d.value;
        });
        let _data = [];
        for (let key in indexed) {
            xDomain.forEach((x) => {
                indexed[key][`${x}_change`] =
                    indexed[key][x] / indexed[key][xDomain[0]];
            });
            _data.push(indexed[key]);
        }
        return _data;
    }
    function makeYDomain(data) {
        let min;
        let max;
        data.forEach((d) => {
            xDomain.forEach((x) => {
                let val = d[yKey(x)];
                if (!min || val < min) min = val;
                if (!max || val > max) max = val;
            });
        });
        return [min, max];
    }
    function makePath(d) {
        let series = xDomain.map((x) => ({ x: x, y: d[yKey(x)] }));
        return (
            "M" + series.map((d) => `${xScale(d.x)} ${yScale(d.y)}`).join("L")
        );
    }
    function yPos(y2, y1) {
        const buffer = 14;
        if (y2 < y1 - buffer || y2 > y1 + buffer) return y2;
        else if (y2 < y1) return y1 - buffer;
        else return y1 + buffer;
    }

    function update(data) {
        _data = transformData(data);
        yDomain = makeYDomain(_data);
        zDomain = _data
            .map((d) => d[zKey])
            .filter((v, i, a) => a.indexOf(v) === i);
        xScale = scalePoint()
            .domain(xDomain)
            .range([0, 100]);
        yScale = scaleLinear().domain([yDomain[0], yDomain[1]]).range([100, 0]);
        loaded = true;
    }
    $: update(data);


    $: console.log({_data, xDomain, scaled: xScale?.("Sep 2000")});
</script>

{#if loaded}
    <ul class="legend-block">
        {#if zDomain[1]}
            {#each zDomain as group, i}
                <li>
                    <div
                        class="legend-vis marker-vis"
                        style:border-bottom={i == 0
                            ? `${lineWidth + 1.5}px solid #27A0CC`
                            : `${lineWidth}px solid black`}
                    ></div>
                    <span class={i == 0 ? "bold" : "brackets"}>{group}</span>
                </li>
            {/each}
        {/if}
    </ul>

    <div class="line-group" style:height="{height}px">
        <div class="baseline" style:top="{yScale(1)}%" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {#each [..._data].reverse() as d, i}
                <path
                    d={makePath(d)}
                    vector-effect="non-scaling-stroke"
                    stroke={i == _data.length - 1 ? "#27A0CC" : "black"}
                    stroke-width={i == _data.length - 1
                        ? lineWidth + 1.5
                        : lineWidth}
                />
            {/each}
        </svg>
        <div
            class="point point-black"
            style:left="{xScale(xVal)}%"
            style:top="{yScale(_data[1][yKey(xVal)])}%"
        />
        <div
            class="point"
            style:left="{xScale(xVal)}%"
            style:top="{yScale(_data[0][yKey(xVal)])}%"
        />
        {#if xVal != xDomain[0]}
        <div
                class="point-text brackets"
                style:left="{xScale(xVal)}%"
                style:top="{yScale(_data[1][yKey(xVal)])}%"
            >
                {formatTick(_data[1][yKey(xVal)])}%
            </div>
            <div
                class="point-text bold"
                style:left="{xScale(xVal)}%"
                style:top="{yPos(yScale(_data[0][yKey(xVal)]), yScale(_data[1][yKey(xVal)]))}%"
            >
                {formatTick(_data[0][yKey(xVal)])}%
            </div>
        {/if}
    </div>

    <div class="x-scale" style:height="1rem">
        <div style:left="0">{xDomain[0]}</div>
        <div style:right="0">{xDomain[xDomain.length - 1]}</div>
    </div>
{/if}

{#if base}
    <small>{base}</small>
{/if}

<style>
    .bold {
        font-weight: bold;
        color: #1b708f;
    }
    .brackets::before {
        content: "(";
    }
    .brackets::after {
        content: ")";
    }
    .line-group,
    .x-scale {
        display: block;
        position: relative;
        width: calc(100% - 50px);
    }
    .line-group {
        z-index: 1;
        margin-top: 24px;
    }
    .baseline {
        position: absolute;
        left: 0;
        width: 100%;
        border-top: 1.5px solid #555;
    }
    .x-scale {
        position: relative;
        font-size: 0.9rem;
    }
    .x-scale > div {
        position: absolute;
        top: 0;
        line-height: normal;
        padding: 5px 3px 0;
        border-left: 1px solid grey;
    }
    .x-scale > div:last-of-type {
        border-left: none;
        border-right: 1px solid grey;
    }
    .marker-vis {
        transform: translate(0, calc(3px - 0.5rem)) !important;
    }
    ul.legend-block {
        list-style-type: none;
        padding: 0;
        margin: 0 0 5px 0;
        min-height: 1rem;
    }
    ul.legend-block > li {
        display: inline-block;
        margin: 0 10px 0 0;
        padding: 0;
    }
    .legend-vis {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        transform: translate(0, 3px);
    }
    svg {
        width: 100%;
        height: 100%;
        overflow: visible;
    }
    path {
        fill: none;
    }
    .point {
        position: absolute;
        width: 10px;
        height: 10px;
        background-color: #27a0cc;
        border-radius: 50%;
        transform: translate(-50%, -50%);
    }
    .point-black {
        width: 8px;
        height: 8px;
        background-color: black;
    }
    .point-text {
        position: absolute;
        line-height: 1;
        background-color: rgba(245, 245, 246, 0.5);
        transform: translate(6px, -50%);
        font-size: 16px;
    }
    .point-text.brackets {
        font-size: 0.85em;
    }
    small {
        font-size: 14px;
        line-height: 1.3;
        display: block;
        margin-top: 10px;
        color: #707070;
    }
</style>
