# Desmos User-Scripts

This repository is a collection of user-scripts that automate certain tasks or add features to Desmos in order to enhance the productivity or enjoyability of the app.

The scripts in this collection are the following:

#### [Desmos Graphing Calculator](https://www.desmos.com/calculator)
1. **[Art Tools](https://github.com/SlimRunner/desmos-scripts-addons/tree/master/art-tools-script)** — adds a tray of options next to the default color tray that allows you to select a custom color, change opacity, and/or change the line width of an expression.
1. **[Table Tools](https://github.com/SlimRunner/desmos-scripts-addons/tree/master/table-tools-script)** — Allows to add points interactively using `ctrl` + `left mouse button`. Points are aggregated into a table of your choice that can be selected through a button that appears next to valid table expressions.
1. **[Right Click Patch](https://github.com/SlimRunner/desmos-scripts-addons/tree/master/right-click-patch)** — A small quality of life patch that allows you to right click the color bubble to open the color tray instead of a long-hold.
1. **[Alpha Features Enabler](https://github.com/SlimRunner/desmos-scripts-addons/tree/master/alpha-feature-enabler)** - Enables the advanced styling features that are in alpha as of November 2020. First discovered by the discord user ElFisho_2. Desmos developers warn to use these with care for the time being because they are highly experimental features.

*There is a readme in each script folder with more in-depth details about the script itself.*

## Getting Started

All the scripts are tested and developed to work with [TamperMonkey](https://www.tampermonkey.net/), a browser extension that runs user-scripts. Technically, the scripts should work with any standard user-script manager but if you use anything other than TamperMonkey you might have to fiddle with the settings to get it to work.

The general installation process is similar for all scripts. Using TamperMonkey is as follows:

### Prerequisites

Follow the link to [TamperMonkey's website](https://www.tampermonkey.net/) where you can pick your preferred browser to install the extension.

### Installation

Once the extension is installed you can either navigate towards the respective script file in this repository and click `raw` on the upper right corner or click the following links for the script you want to install:

* [Art Tools](https://github.com/SlimRunner/desmos-scripts-addons/raw/master/art-tools-script/dgc-art-tools.user.js)
* [Table Tools](https://github.com/SlimRunner/desmos-scripts-addons/raw/master/table-tools-script/dgc-table-tools.user.js)
* [Right Click Patch](https://github.com/SlimRunner/desmos-scripts-addons/raw/master/right-click-patch/dcg-rmb-color.user.js)
* [Alpha Features Enabler](https://github.com/SlimRunner/desmos-scripts-addons/raw/master/alpha-feature-enabler/dgc-alpha-enabler.user.js)

Either way you will be prompted automatically by TamperMonkey to install the scripts. Click `install` or `reinstall` if you are updating. Once installed, you can periodically check for updates in TamperMonkey, and you will be served the latest changes from the master branch of this repository.
