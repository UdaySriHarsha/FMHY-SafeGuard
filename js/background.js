const filterListURLUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist.txt";
const filterListURLPotentiallyUnsafe =
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/refs/heads/main/sitelist-plus.txt";
const safeListURL = "https://api.fmhy.net/single-page";
const starredListURL =
  "https://raw.githubusercontent.com/fmhy/bookmarks/refs/heads/main/fmhy_in_bookmarks_starred_only.html";

let unsafeSites = [];
let potentiallyUnsafeSites = [];
let safeSites = [];
let starredSites = ["https://fmhy.net"];

// Helper function to extract URLs from markdown text
function extractUrlsFromMarkdown(markdown) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return markdown.match(urlRegex) || [];
}

// Helper function to extract URLs from HTML bookmarks
function extractUrlsFromBookmarks(html) {
  const urlRegex = /<A HREF="(https?:\/\/[^\s"]+)"/g;
  let matches;
  const urls = [];
  while ((matches = urlRegex.exec(html)) !== null) {
    urls.push(matches[1]);
  }
  return urls;
}

// Helper function to normalize URLs (removes trailing slashes and "www.")
function normalizeUrl(url) {
  return url.replace(/\/+$/, "").replace(/^https?:\/\/www\./, "https://"); // Remove trailing slash if exists and "www." if present
}

// Fetch the unsafe and potentially unsafe filter lists
async function fetchFilterLists() {
  console.log("Fetching filter lists...");

  try {
    const [unsafeResponse, potentiallyUnsafeResponse] = await Promise.all([
      fetch(filterListURLUnsafe),
      fetch(filterListURLPotentiallyUnsafe),
    ]);

    if (unsafeResponse.ok) {
      const unsafeText = await unsafeResponse.text();
      unsafeSites = unsafeText
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
    }

    if (potentiallyUnsafeResponse.ok) {
      const potentiallyUnsafeText = await potentiallyUnsafeResponse.text();
      potentiallyUnsafeSites = potentiallyUnsafeText
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
    }

    console.log("Parsed Unsafe Sites:", unsafeSites);
    console.log("Parsed Potentially Unsafe Sites:", potentiallyUnsafeSites);
  } catch (error) {
    console.error("Error fetching filter lists:", error);
  }
}

// Fetch the safe sites
async function fetchSafeSites() {
  console.log("Fetching safe sites...");
  try {
    const response = await fetch(safeListURL);
    if (response.ok) {
      const markdown = await response.text();
      const urls = extractUrlsFromMarkdown(markdown);
      urls.forEach((siteUrl) => {
        let fullUrl = normalizeUrl(siteUrl.trim());
        if (!safeSites.includes(fullUrl)) {
          safeSites.push(fullUrl);
        }
      });
    }
    console.log("Parsed Safe Sites:", safeSites);
  } catch (error) {
    console.error("Error fetching safe sites:", error);
  }
}

// Fetch the starred sites
async function fetchStarredSites() {
  console.log("Fetching starred sites...");
  try {
    const response = await fetch(starredListURL);
    if (response.ok) {
      const html = await response.text();
      const urls = extractUrlsFromBookmarks(html);

      // Normalize and add URLs to the starredSites array
      starredSites = [...new Set(urls.map(normalizeUrl))];

      // Ensure fmhy.net, librechat.ai, and other important sites are always in the starred list
      if (!starredSites.includes("https://fmhy.net")) {
        starredSites.push("https://fmhy.net");
      }

      console.log("Parsed Starred Sites:", starredSites);
    }
  } catch (error) {
    console.error("Error fetching starred sites:", error);
  }
}

// Update the toolbar icon based on the site's status
function updateIcon(status, tabId) {
  let iconPath = "res/ext_icon_144.png"; // Default extension icon

  if (status === "safe") {
    iconPath = "res/icons/safe.png";
  } else if (status === "unsafe") {
    iconPath = "res/icons/unsafe.png";
  } else if (status === "potentially_unsafe") {
    iconPath = "res/icons/potentially_unsafe.png";
  } else if (status === "starred") {
    iconPath = "res/icons/starred.png";
  }

  browser.browserAction.setIcon({
    path: iconPath,
    tabId: tabId,
  });
}

// Check the site status for a given tab and URL
function checkSiteAndUpdateIcon(tabId, url) {
  if (!url) return;

  const currentUrl = normalizeUrl(url.trim());
  console.log(
    "Checking site status for toolbar icon:",
    currentUrl,
    "TabId:",
    tabId
  );

  // Check if the site is starred, safe, unsafe, or potentially unsafe
  let isStarred = starredSites.some(
    (site) => normalizeUrl(site) === currentUrl
  );
  let isSafe = safeSites.some((site) => normalizeUrl(site) === currentUrl);
  let isUnsafe = unsafeSites.some((site) =>
    currentUrl.includes(normalizeUrl(site))
  );
  let isPotentiallyUnsafe = potentiallyUnsafeSites.some((site) =>
    currentUrl.includes(normalizeUrl(site))
  );

  // Prioritize starred sites first, then safe sites
  if (isStarred) {
    console.log("Updating toolbar icon to starred for:", currentUrl);
    updateIcon("starred", tabId);
  } else if (isSafe) {
    console.log("Updating toolbar icon to safe for:", currentUrl);
    updateIcon("safe", tabId);
  } else if (isUnsafe) {
    console.log("Updating toolbar icon to unsafe for:", currentUrl);
    updateIcon("unsafe", tabId);
  } else if (isPotentiallyUnsafe) {
    console.log("Updating toolbar icon to potentially unsafe for:", currentUrl);
    updateIcon("potentially_unsafe", tabId);
  } else {
    console.log("No data for this site:", currentUrl);
    updateIcon("default", tabId);
  }
}

// Listen for messages from the popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background for site:", message.url);
  if (message.action === "checkSiteStatus") {
    const currentUrl = normalizeUrl(message.url.trim());
    let isStarred = starredSites.some(
      (site) => normalizeUrl(site) === currentUrl
    );
    let isSafe = safeSites.some((site) => normalizeUrl(site) === currentUrl);
    let isUnsafe = unsafeSites.some((site) =>
      currentUrl.includes(normalizeUrl(site))
    );
    let isPotentiallyUnsafe = potentiallyUnsafeSites.some((site) =>
      currentUrl.includes(normalizeUrl(site))
    );

    if (isStarred) {
      sendResponse({ status: "starred", url: currentUrl });
    } else if (isSafe) {
      sendResponse({ status: "safe", url: currentUrl });
    } else if (isUnsafe) {
      sendResponse({ status: "unsafe", url: currentUrl });
    } else if (isPotentiallyUnsafe) {
      sendResponse({ status: "potentially_unsafe", url: currentUrl });
    } else {
      sendResponse({ status: "no_data", url: currentUrl });
    }
  }
  return true;
});

// Initialize the extension
async function initializeExtension() {
  // Fetch all necessary lists
  await fetchFilterLists();
  await fetchSafeSites();
  await fetchStarredSites();

  // Listen for tab updates after lists are fetched
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      checkSiteAndUpdateIcon(tabId, tab.url);
    }
  });

  // Listen for tab activation after lists are fetched
  browser.tabs.onActivated.addListener((activeInfo) => {
    browser.tabs.get(activeInfo.tabId, (tab) => {
      if (tab.url) {
        checkSiteAndUpdateIcon(tab.id, tab.url);
      }
    });
  });

  console.log("Extension initialized successfully.");
}

// Initialize everything once the extension is loaded
initializeExtension();
