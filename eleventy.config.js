export default async function (eleventyConfig) {
  eleventyConfig.setInputDirectory('src')
  eleventyConfig.setLayoutsDirectory("layouts");
  eleventyConfig.addPassthroughCopy("src/**/*.mp3")
  eleventyConfig.addCollection("allDates", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/dates/*.md");
  });
  eleventyConfig.addFilter("repeat", (str, times) => {
    return str.repeat(times);
  });
  return {
    markdownTemplateEngine: "njk"
  }
};
