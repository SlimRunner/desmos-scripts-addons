# Desmos User-Scripts

This repository is a collection of user-scripts that automate certain tasks or add features to Desmos in order to enhance the productivity or enjoyability of the app.

The scripts in this collection are the following:

#### [Desmos Graphing Calculator](https://www.desmos.com/calculator)
1. **[Art Tools][arttoolsfolder]** — Adds a tray of options next to the default color panel. Currently, it only has a color picker to select a custom color using an HSV wheel.
1. **[Table Tools][tabletoolsfolder]** — Allows you to add points interactively using `ctrl` + `left mouse button`. Points are aggregated into a table of your choice that can be selected through a button that appears next to valid table expressions. Also gives you the option to make a polygon from a table, and allows tables to be copied to your clipboard in `.tsv` format.
1. **[Right Click Patch][rmbpatchfolder]** — A small quality of life patch that allows you to right click the color bubble to open the color tray instead of having to long-hold.
1. **[Color Tray Patch][traypatchfolder]** — Overrides the behavior of the color tray so that when you have more than 5 rows of colors you get a scrollbar to keep things neat. This script might need be removed in the future when this is fixed officially by Desmos. I'll update this script to show a message when that happens.
1. **[Graph Archiver][archivefolder]** — Adds two buttons in the top right corner to save the graph as a stringified plain-text file that can be locally saved or shared.

## Getting Started

All the scripts are tested and developed to work with [TamperMonkey](https://www.tampermonkey.net/), a browser extension that runs user-scripts. Technically, the scripts should work with any standard user-script manager but if you use anything other than TamperMonkey you might have to fiddle with the settings to get it to work.

The general installation process is similar for all scripts. Using TamperMonkey is as follows:

### Prerequisites

Follow the link to [TamperMonkey's website](https://www.tampermonkey.net/) where you can pick your preferred browser to install the extension.

### Installation

Once the extension is installed you can either navigate towards the respective script file in this repository and click `raw` on the upper right corner or click the following links for the script you want to install:

* [Art Tools][arttoolsraw]
* [Table Tools][tabletoolsraw]
* [Right Click Patch][rmbpatchraw]
* [Color Tray Patch][traypatchraw]
* [Graph Archiver][archiveraw]

Either way you will be prompted automatically by TamperMonkey to install the scripts. Click `install` or `reinstall` if you are updating. Once installed, you can periodically check for updates in TamperMonkey, and you will be served the latest changes from the master branch of this repository.

[arttoolsfolder]: /art-tools-script
[tabletoolsfolder]: /table-tools-script
[rmbpatchfolder]: /right-click-patch
[alphaenablerfolder]: /alpha-feature-enabler
[traypatchfolder]: /tray-scroll-patch
[archivefolder]: /graph-archival-script
[desmoviefolder]: /desmovie-script
[arttoolsraw]: https://github.com/SlimRunner/desmos-scripts-addons/raw/master/art-tools-script/dgc-art-tools.user.js
[tabletoolsraw]: https://github.com/SlimRunner/desmos-scripts-addons/raw/master/table-tools-script/dgc-table-tools.user.js
[rmbpatchraw]: https://github.com/SlimRunner/desmos-scripts-addons/raw/master/right-click-patch/dcg-rmb-color.user.js
[alphaenablerraw]: https://github.com/SlimRunner/desmos-scripts-addons/raw/master/alpha-feature-enabler/dgc-alpha-enabler.user.js
[traypatchraw]: https://github.com/SlimRunner/desmos-scripts-addons/raw/master/tray-scroll-patch/dgc-scroll-patch.user.js
[archiveraw]: https://github.com/SlimRunner/desmos-scripts-addons/raw/master/graph-archival-script/dgc-graph-archive.user.js
[desmovieraw]: https://github.com/SlimRunner/desmos-scripts-addons/raw/master/desmovie-script/desmovie.user.js
