# Desmos User-Script

Adds extra functionalities to Desmos Graphing Calculator, like changing color directly from a color picker!

# Installation

* ## Release Version (self-managed)
1. Install [TamperMonkey](https://www.tampermonkey.net/) in your preferred browser.
1. Open [this gist](https://gist.github.com/SlimRunner/aacc9cea998a3a8da31eae9d487412d7) to access the most current stable version.
1. Click the `Raw` button.
1. Press `install` when prompted by TamperMonkey.
1. Anytime you open [Desmos](https://www.desmos.com/calculator) TamperMonkey will automatically load the script, and will prompt you to install new versions when they become available.

* ## Nightly Version (manual)

1. Install [TamperMonkey](https://www.tampermonkey.net/) in your preferred browser.
1. Go to the [source code](src/color-picker-gui.js) and copy the raw code.
1. Enter the settings in TamperMonkey.
1. Add a new script and replace the default code with what you copied on step 2.
1. Anytime you open [Desmos](https://www.desmos.com/calculator) TamperMonkey will automatically load the script. If you want a new version you have to repeat the steps from 2 to 4.

### Notes and Known Issues

* This script was tested first on GreasyMonkey, but it never worked. Feel free to try other user-script managers, but there are no guarantee that it will work.
* Whenever you change the color of a table column with computed values, the values will disappear. In order for them to be re-computed you must force a refresh on the values. The easiest way is to hide and show any column.
