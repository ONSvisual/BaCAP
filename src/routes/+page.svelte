<script>
  import {
    Section,
    Breadcrumb,
    Titleblock,
    Button,
    Cards,
    Card,
  } from "@onsvisual/svelte-components";
  import HeaderImage from "$lib/layout/HeaderImage.svelte";
  import { base } from "$app/paths";
</script>

<Breadcrumb
  theme="blue"
  links={[{ label: "Home", href: "/", refresh: true }]}
/>
<Titleblock
  title="Build a custom area profile"
  lede="Create your own profile for local areas with data for England and Wales"
  theme="blue"
>
  <HeaderImage />
  <Section width="full">
    <Button variant="ghost" icon="arrow" iconPosition="after" href="{base}/draw"
      >Get started</Button
    >
  </Section>
</Titleblock>
<Section marginTop>
  <h2>How to use the profile builder</h2>

  <p>There are two steps to build your custom area profile.</p>
</Section>
<!-- <Section width="wide" background="#f5f5f5"> -->
<Cards width="medium" colWidth="wide">
  <Card title="Step 1 - Select an area" mode="featured">
    <p>There are four ways to select an area:</p>
    <ol>
      <li>Search for an area in the search box.</li>
      <li>Draw a polygon on the map.</li>
      <li>Draw a circle on the map.</li>
      <li>Upload an area boundary.</li>
    </ol>
    <p>
      Once you have finished selecting an area, click on the “Build profile”
      button.
    </p>
  </Card>

  <Card title="Step 2 - Build a profile" mode="featured">
    <p>
      Once you have selected your area, choose which datasets you want for your
      profile.
    </p>

    <p>
      The profile will be built as you choose datasets showing values for your
      area and a preset comparison area for context. You can change this
      comparison area.
    </p>

    <p>You will be able to download data and charts from your profile.</p>
  </Card>
</Cards>
<!-- </Section> -->
<Section>
  <h3>Which datasets are available?</h3>
  <p>
    This tool includes a variety of datasets that can be aggregated from small
    area data at an LSOA or Output Area level.
  </p>
  <p>
    You can find a description of all available datasets on the
    <a href="{base}/glossary">glossary page</a>.
  </p>
</Section>
<Section>
  <h3>How does this tool produce these figures?</h3>
  <p>
    The tool takes your chosen shape and compares it to your selected datasets.
  </p>
  <p>
    It produces a best-fit shape, which is the closest available to your chosen
    shape. It adds up the small area data for your best-fit shape and returns it
    as an estimated total.
  </p>
  <p>
    Census 2021 topics and non-Census datasets use different small area types.
  </p>
  <p>
    Census 2021 topics use Output Areas (OAs) whereas non-Census datasets
    primarily use larger Lower layer Super Output Areas (LSOAs).
  </p>
  <p>
    We advise caution when comparing values between Census topics and non-Census
    datasets because these best-fit shapes will have different boundaries.
  </p>
</Section>
<Section>
  <h3>Share your feedback</h3>
  <p>
    We value your feedback on this service. If you would like to get in touch,
    please email <a href="mailto:explore.local.statistics@ons.gov.uk"
      >explore.local.statistics@ons.gov.uk</a
    >.
  </p>
</Section>

<style>
  .list-container {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    list-style-type: none;
    padding: 0;
  }
  .list-item {
    background-color: #f8f9fa;
    border-radius: 4px;
    padding: 10px 15px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    min-width: 200px;
    flex: 1 1 auto;
    transition: all 0.2s ease;
  }
  /* .list-item:hover {
      background-color: #e9ecef;
      transform: translateY(-2px);
      box-shadow: 0 3px 5px rgba(0,0,0,0.15);
  } */
  @media (max-width: 768px) {
    .list-item {
      min-width: 150px;
    }
  }
  @media (max-width: 480px) {
    .list-item {
      min-width: 100%;
    }
  }
</style>
