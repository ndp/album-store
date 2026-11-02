export default async function (eleventyConfig) {
  eleventyConfig.setInputDirectory('src')
  eleventyConfig.setLayoutsDirectory("layouts");
  eleventyConfig.addPassthroughCopy("src/**/*.mp3")
  return eleventyConfig
};
