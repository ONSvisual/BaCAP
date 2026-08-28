<script>
  import topicsAll from "$lib/config/topics.json";
  import { base } from "$app/paths";
  import {
    Breadcrumb,
    Icon,
    Titleblock,
    NavSections,
    NavSection,
  } from "@onsvisual/svelte-components";
  import {
    isDatasetAvailableInVersion,
    getDatasetForVersion,
  } from "$lib/util/topic-functions";
  import { version } from "$lib/stores/mapstore.js";
  import { get } from "svelte/store";

  function groupTopics(indicators) {
    const filtered = indicators
      .filter((d) => isDatasetAvailableInVersion(d, get(version)) && d.chart !== "line")
      .map((d) => getDatasetForVersion(d, get(version)))
      .sort((a, b) => a.label.localeCompare(b.label));
    const topics = {};
    for (const ind of filtered) {
      if (!topics[ind.topic]) topics[ind.topic] = [];
      topics[ind.topic].push(ind);
    }
    return Object.entries(topics).map((entry) => ({
      label: entry[0],
      indicators: entry[1],
    })).sort((a, b) => a.label.localeCompare(b.label));;
  }

  $: topics = groupTopics(topicsAll);
</script>

<Breadcrumb
  theme="grey"
  links={[
    { label: "Home", href: "/", refresh: true },
    {
      label: "Build a custom area profile",
      href: `${base}/`,
      refresh: true,
    },
  ]}
/>
<Titleblock theme="grey" title="Glossary">
  <p>A description of all the datasets available within the <a href="{base}/">Build a Custom Area Profile tool</a>.</p>
</Titleblock>
<NavSections contentsLabel="Topics" marginTop>
  {#each topics as topic, i}
    <NavSection title={topic.label}>
      <div class="indicator-item">
        {#each topic.indicators as ind}
          <h3 id={ind.code} class="ons-u-mt-m">{ind.label}</h3>
          {#if ind.descLong}
            {@html ind.descLong}
          {:else}
            <p>{ind.desc}</p>
          {/if}
          {#if ind.url}<a class="btn-link" href={`/${ind.url}`} target="_blank"
              >Read more <Icon type="chevron" size="s" /></a
            >{/if}
        {/each}
      </div>
    </NavSection>
    {#if i !== topics.length - 1}<hr class="hr-full" />{/if}
  {/each}
</NavSections>

<style>
  .indicator-item h3 {
    font-size: 1em;
    margin: 1.2em 0 .5em !important;
  }
  .indicator-item :global(p), .indicator-item :global(li) {
    margin-bottom: .5em;
  }
  .hr-full {
    margin-bottom: .5em;
  }
</style>