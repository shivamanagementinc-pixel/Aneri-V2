const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("reports");   // ← ADD THIS
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

  // Load every content/homepage/*.md file's front matter into a single
  // `homepage` global data object, keyed by filename (hyphens -> underscores
  // to match the CMS collection's field names in config.yml).
  // e.g. content/homepage/who-we-help.md -> homepage.who_we_help
  eleventyConfig.addGlobalData("homepage", () => {
    const dir = path.join(__dirname, "content/homepage");
    const data = {};
    if (!fs.existsSync(dir)) return data;
    fs.readdirSync(dir)
      .filter((file) => file.endsWith(".md"))
      .forEach((file) => {
        const key = path.basename(file, ".md").replace(/-/g, "_");
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const { data: frontMatter } = matter(raw);
        data[key] = frontMatter;
      });
    return data;
  });

  // These homepage content files are pure data (read above), not standalone
  // pages — prevent Eleventy from also rendering each one as its own output
  // page. `permalink: false` in each file is the primary safeguard (works on
  // any Eleventy version); this is an extra belt-and-suspenders for v2+.
  if (eleventyConfig.ignores && typeof eleventyConfig.ignores.add === "function") {
    eleventyConfig.ignores.add("content/homepage/**/*.md");
  }

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
