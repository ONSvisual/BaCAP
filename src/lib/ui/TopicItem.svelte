<script>
  import Icon from "$lib/ui/Icon.svelte";

  export let topic; // Topic of this item
  export let regex;
  export let show;
  export let hovered = false;
  export let selected = false;
  
  let showInfo = false;

  function highlight(str, regex) {
    return regex ? str.replace(regex, '<mark>$&</mark>') : str;
  }
</script>

<div class="topic-item" style:display={show ? 'flex' : 'none'}>
  <label>
    <slot/>
    {@html highlight(topic.label, regex)}
  </label>
  <button
    class="topic-toggle"
    title="{showInfo ? 'Hide' : 'Show'} description for {topic.label}"
    on:click={() => showInfo = !showInfo}
    on:mouseenter={() => hovered = true}
    on:mouseleave={() => hovered = false}
    >
    <Icon type="info" scale={hovered ? 1.2 : 1}/>
  </button>
</div>

{#if show}

{#if showInfo}
<div class="topic-info">
  <p>
    {topic.desc}
    {#if topic.url}
    <!-- svelte-ignore security-anchor-rel-noreferrer -->
    <a href="https://www.ons.gov.uk/census/census2021dictionary/variablesbytopic/{topic.url}" target="_blank">Read more</a>
    {/if}
  </p>
</div>
{/if}

{#if topic.caveatText && (selected || showInfo)}
<div class="topic-info">
  <p>
    <span class="inline-icon"><Icon type="error"/></span>
    {topic.caveatText}
    {#if topic.caveatUrl}
    <!-- svelte-ignore security-anchor-rel-noreferrer -->
    <a href="https://www.ons.gov.uk/{topic.caveatUrl}" target="_blank">Read more</a>
    {/if}
  </p>
</div>
{/if}

{/if}

<style>
  .topic-item {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin: 4px 0 1px;
    background-color: white;
  }
  .topic-item > label:focus-within {
    outline: 4px solid #fbc900;
    flex-grow: 1;
  }
  .topic-info {
    margin: 0;
    padding: 16px;
    background-color: rgb(245,245,246);
    border-left: 4px solid rgb(112,112,113);
  }
  .topic-info + .topic-info {
    padding-top: 0;
  }
  .topic-toggle {
    margin: 0;
    padding: 0;
    background: none;
    border: none;
    font-size: 0.8em;
    width: 18px;
    color: #444;
  }
  .topic-toggle:hover, .topic-toggle:active {
    color: #000;
    background: none !important;
  }
  .topic-toggle:focus {
    outline: 4px solid #fbc900;
  }
  p {
    margin: 0;
  }
  p + p {
    margin-top: 16px;
  }
  .inline-icon {
    display: inline-block;
    transform: translateY(3px);
    margin-right: 3px;
  }
</style>