export default async function (eleventyConfig) {
  eleventyConfig.setInputDirectory('src')
  eleventyConfig.setLayoutsDirectory("layouts");
  eleventyConfig.addPassthroughCopy("src/**/*.mp3")
  eleventyConfig.addCollection("allDates", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/dates/*.md");
  });
  return {
    markdownTemplateEngine: "njk"
  }
};
