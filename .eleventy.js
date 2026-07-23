module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("_redirects");
  eleventyConfig.addPassthroughCopy("netlify.toml");

  eleventyConfig.addFilter("dateDisplay", (date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date)
  );

  eleventyConfig.addCollection("blog", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("content/blog/*.md")
      .sort((firstPost, secondPost) => secondPost.date - firstPost.date)
  );

  return {
    dir: {
      input: ".",
      includes: "_includes",
      layouts: "_includes",
      output: "_site",
    },
    templateFormats: ["md", "html", "njk"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
