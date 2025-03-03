// ==UserScript==
// @name        DesmosSavedView
// @namespace   slidav.Desmos
// @version     0.0.1
// @author      SlimRunner (David Flores)
// @description Scrolls currently open graph into view when browsing graphs
// @grant       none
// @match       https://*.desmos.com/calculator*
// @match       https://*.desmos.com/geometry*
// @match       https://*.desmos.com/3d*
// @downloadURL https://github.com/SlimRunner/desmos-scripts-addons/raw/master/saved-into-view/dgc-saved-into-view.user.js
// @updateURL   https://github.com/SlimRunner/desmos-scripts-addons/raw/master/saved-into-view/dgc-saved-into-view.user.js
// ==/UserScript==

(function () {
  "use strict";
  var Calc, CTag;

  defineScript();

  /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
  // helper functions

  // queries the list of graphs and returns them
  function captureList() {
    const userQuery = `#mygraphs-container .dcg-mygraphs.logged-in div[role="list"]`;
    const anonQuery = `#mygraphs-container .dcg-mygraphs div[role="list"]`;
    let res = document.querySelectorAll(userQuery);
    const loggedIn = res.length != 0;
    if (!loggedIn) {
      res = document.querySelectorAll(anonQuery);
    }
    if (res.length == 0) {
      throw new Error("Graphs drawer could not be found.");
    } else if (res.length != 2) {
      console.error(res);
      console.error(`query resulted in ${res.length} elements`);
      throw new Error("Graphs drawer query gave unexpected result.");
    }
    return { loggedIn, elements: res };
  }

  // observe clicks on the hamburger button for resources
  function observeClick(query, callback) {
    const {
      loggedIn,
      elements: [gSaved, gExample],
    } = captureList();

    const graphsQuery = [
      ".saved-graph.graph-link-container",
      ".graph-link",
      ".dcg-graph-details",
      ".dcg-title",
    ].join(" ");

    const savedMap = new Map(
      Array.from(gSaved.querySelectorAll(graphsQuery)).map((e) => [
        e.textContent,
        e,
      ])
    );

    const exampleMap = new Map(
      Array.from(gExample.querySelectorAll(graphsQuery)).map((e) => [
        e.textContent,
        e,
      ])
    );

    if (
      (query instanceof String || typeof query === "string") &&
      callback instanceof Function &&
      callback.length == 2
    ) {
      const button = document.querySelector(query);
      if (button === null) {
        console.error(`query failed: ${query}`);
        throw new Error("Drawer button was not found.");
      }
      button.addEventListener("click", () => {
        callback(savedMap, exampleMap);
      });
    } else {
      throw new Error(
        "Callback is not valid. Expected function with 2 params."
      );
    }
  }

  // returns the title of the graph or undefined
  function getGraphName() {
    const title =
      Calc._calc.globalHotkeys.mygraphsController.graphsController.currentGraph
        .title;
    if (title instanceof String || typeof title === "string") {
      return title;
    } else {
      return null;
    }
  }

  // scroll open graph into view if it is saved or example
  function scrollIntoView(savedMap, exampleMap) {
    if (!(savedMap instanceof Map && exampleMap instanceof Map)) {
      return;
    }
    const title = getGraphName();

    if (title !== null) {
      if (savedMap.has(title)) {
        savedMap.get(title).scrollIntoView();
      } else if (exampleMap.has(title)) {
        exampleMap.get(title).scrollIntoView();
      }
    }
  }

  /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
  // User-Script Initialization

  // defines an object that is shared among my scripts
  function defineScript() {
    if (window.SLM === undefined) {
      console.log(
        "scripts by\n" +
          " _____ _ _          ______                            \n" +
          "/  ___| (_)         | ___ \\                           \n" +
          "\\ `--.| |_ _ __ ___ | |_/ /   _ _ __  _ __   ___ _ __ \n" +
          " `--. \\ | | '_ ` _ \\|    / | | | '_ \\| '_ \\ / _ \\ '__|\n" +
          "/\\__/ / | | | | | | | |\\ \\ |_| | | | | | | |  __/ |   \n" +
          "\\____/|_|_|_| |_| |_\\_| \\_\\__,_|_| |_|_| |_|\\___|_|   \n"
      );

      window.SLM = Object.assign(
        {},
        {
          messages: [],
          scripts: [GM_info.script.name],

          printMsgQueue: function () {
            while (this.printMessage()) {}
          },

          printMessage: function () {
            if (this.messages.length === 0) return false;
            let msg = this.messages.shift();
            console[msg.type](...msg.args);
            return this.messages.length !== 0;
          },

          pushMessage: function (type, ...msgArgs) {
            this.messages.push({
              type: type,
              args: msgArgs,
            });
          },
        }
      );

      Object.defineProperties(window.SLM, {
        MESSAGE_DELAY: {
          value: 500,
          writable: false,
          enumerable: true,
          configurable: true,
        },
        ATTEMPTS_LIMIT: {
          value: 50,
          writable: false,
          enumerable: true,
          configurable: true,
        },
        ATTEMPTS_DELAY: {
          value: 200,
          writable: false,
          enumerable: true,
          configurable: true,
        },
      });
    } else {
      window.SLM.scripts.push(GM_info.script.name);
    }
  }

  // checks if calc and desmos are defined
  function isCalcReady() {
    if (window.Desmos !== undefined && window.Calc !== undefined) {
      Calc = window.Calc;
      return true;
    } else {
      return false;
    }
  }

  // iife that checks if Desmos has finished loading (10 attempts)
  (function loadCheck() {
    const SLM = window.SLM;

    if (loadCheck.attempts === undefined) {
      loadCheck.attempts = 0;
    } else {
      loadCheck.attempts++;
    }

    if (!isCalcReady()) {
      if (loadCheck.attempts < SLM.ATTEMPTS_LIMIT) {
        window.setTimeout(loadCheck, SLM.ATTEMPTS_DELAY);
      } else {
        SLM.pushMessage("warn", "%s aborted loading", GM_info.script.name);
        setTimeout(() => {
          SLM.printMsgQueue();
        }, SLM.MESSAGE_DELAY);
      }
    } else {
      try {
        const tagRx = /(?<=\.com\/)\w+/;
        CTag = tagRx.exec(document.URL)[0];

        const hamburgerQuery = ".align-left-container .dcg-action-opendrawer";
        const resOpenQuery = ".resources-open";

        setTimeout(() => {
          observeClick(hamburgerQuery, (savedMap, exampleMap) => {
            const status = document.querySelector(resOpenQuery);
            if (status) {
              setTimeout(() => {
                scrollIntoView(savedMap, exampleMap);
              }, 200);
            }
          });
        }, 200);

        SLM.pushMessage("log", "%s loaded properly ✔️", GM_info.script.name);
      } catch (ex) {
        SLM.pushMessage("error", `${ex.name}: ${ex.message}`);
        SLM.pushMessage("warn", "An error was encountered while loading");
      } finally {
        setTimeout(() => {
          SLM.printMsgQueue();
        }, SLM.MESSAGE_DELAY);
      }
    }
  })();
})();
