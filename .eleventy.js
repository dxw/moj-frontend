const beautifyHTML = require("js-beautify").html;
const fs = require("fs");
const hljs = require("highlight.js");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const matter = require("gray-matter");
const dxwFilters = require("./src/dxw/filters/all");
const nunjucks = require("nunjucks");
const path = require("path");
const { execSync } = require("child_process");

module.exports = function (eleventyConfig) {
  const nunjucksEnv = nunjucks.configure([
    ".",
    "docs/_includes/",
    "node_modules/govuk-frontend/",
    "node_modules/@ministryofjustice/frontend/",
  ]);

  Object.entries({
    ...eleventyConfig.nunjucksFilters,
    ...dxwFilters(),
  }).forEach(([name, callback]) => {
    nunjucksEnv.addFilter(name, callback);
  });

  eleventyConfig.setLibrary("njk", nunjucksEnv);

  eleventyConfig.setLibrary(
    "md",
    markdownIt({
      html: true,
      highlight: (str, language) =>
        language ? hljs.highlight(str, { language }).value : str,
    })
      .disable("code")
      .use(markdownItAnchor, {
        level: [1, 2, 3, 4],
      })
  );

  eleventyConfig.addShortcode("example", function (exampleHref, height) {
    const { data, content: nunjucksCode } = matter(
      fs
        .readFileSync(
          path.join(__dirname, "docs", exampleHref, "index.njk"),
          "utf8"
        )
        .trim()
    );

    const rawHtmlCode = nunjucksEnv.renderString(nunjucksCode);

    const htmlCode = beautifyHTML(rawHtmlCode.trim(), {
      indent_size: 2,
      end_with_newline: true,
      max_preserve_newlines: 1,
      unformatted: ["code", "pre", "em", "strong"],
    });

    let jsCode = "";
    try {
      jsCode = fs
        .readFileSync(
          path.join(__dirname, "docs", exampleHref, "script.js"),
          "utf8"
        )
        .trim();
    } catch (e) {}

    return nunjucksEnv.render("example.njk", {
      href: exampleHref,
      id: exampleHref.replace(/\//g, "-"),
      arguments: data.arguments,
      height,
      nunjucksCode,
      htmlCode,
      jsCode,
    });
  });

  eleventyConfig.addShortcode("lastUpdated", function (component) {
    const dirPath = path.join(__dirname, "src/dxw/components", component);
    const [commit, lastUpdated] = execSync(
      `LANG=en_GB git log -n1 --pretty=format:%H,%ad --date=format:'%e %B %Y' ${dirPath}`
    )
      .toString()
      .split(",");

    return `<p>Last updated: <a href="https://github.com/dxw/dxw-frontend/commit/${commit}">${lastUpdated}</a></p>`;
  });

  eleventyConfig.addPairedShortcode("banner", function (content, title) {
    return `
      <div class="govuk-notification-banner" role="region" aria-labelledby="govuk-notification-banner-title" data-module="govuk-notification-banner">
        <div class="govuk-notification-banner__header">
          <h2 class="govuk-notification-banner__title" id="govuk-notification-banner-title">
            Important
          </h2>
        </div>
        <div class="govuk-notification-banner__content">
          <h3 class="govuk-notification-banner__heading">
            ${title}
          </h3>
          ${content}</div>
      </div>
    `;
  });

  eleventyConfig.addFilter(
    "addActiveAttribute",
    function (config, filePathStem) {
      if (config.items) {
        return {
          ...config,
          items: config.items.map((item) => ({
            ...item,
            active: filePathStem.indexOf(item.href) > -1,
          })),
        };
      } else if (config.sections) {
        return {
          ...config,
          sections: config.sections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({
              ...item,
              active: filePathStem.indexOf(item.href) > -1,
            })),
          })),
        };
      }
    }
  );

  eleventyConfig.addFilter("getScriptPath", function (inputPath) {
    return inputPath.split("/").slice(1, -1).join("/") + "/script.js";
  });
};
