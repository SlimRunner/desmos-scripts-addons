# Desmos User-Script

This is a web-script designed to provide a graphical interface to access features that are available only directly through the Desmos API. For example, if you would want to change the color of your graph beyond the palette that Desmos offer, you would normally have to open the web-console in your browser and run a script such as the following:

```javascript
state = Calc.getState();
state.expressions.list[i - 1].color = "#000000";
Calc.setState(state, {allowUndo: true});
```

where `i` is the number or index of your graph expression and the string assigned any valid HTML color. Probably you can do this once without problem, but if you are setting up a graph for artistic purposes where you are constantly changing colors, it can get tedious rather quickly.

The list of features currently supported by the script are:

* assign a color with the default color picker
* assign opacity to an expression using LaTeX
* assign line width to an expression using LaTeX

## Getting Started - Users

The installation process is a breeze with the help of a browser extension, and automatic updates are enabled using GitHub Gist for hosting. The process is as follows:

### Prerequisites

First you need to install [TamperMonkey](https://www.tampermonkey.net/), a browser extension available in a wide variety of popular browsers.

### Installation

1. Open [this gist](https://gist.github.com/SlimRunner/aacc9cea998a3a8da31eae9d487412d7) for the most current version of the script.
1. Click the `Raw` button.
1. Press `install` when prompted by TamperMonkey.
1. Anytime you open [Desmos](https://www.desmos.com/calculator) TamperMonkey will automatically load the script, and will prompt you to install new versions when they become available.

## Known Issues

* This script was tested first on GreasyMonkey, but it never worked. Feel free to try other user-script managers, but there are no guarantee that it will work.
* Whenever you change the color of a table column with computed values, the values will disappear. In order for them to be re-computed you must force a refresh on the values. The easiest way is to hide and show any column.
* Changing the line width of an expression will cause the whole graph to refresh because of constraints imposed by the Desmos API itself.
* The button for opacity was restricted purposefully under certain circumstances<sup>[1]</sup>. The reason is that the Desmos API rejects opacity requests to the Calc object if the expression isn't a fillable expression. The following is what constitutes a fillable expression:
	* an valid expression using the `polygon` function
	* a valid parametric expression
* The line-width button isn't restricted because this property never gets rejected by the Calc object under any circumstance. However, **Desmos will NOT prompt you to add a non-existent expression** if you add a new expression as line-width.

#### Notes:
* [1]: Currently the button doesn't give any warning if it rejects your request to change opacity.
