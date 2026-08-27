
chrome.runtime.onMessage.addListener((request) => {

  if (request.action === "AUTO_LOGIN") {

    const user = request.user;
    const pass = request.pass;

    const userInput = document.querySelector(
      "input[type='text'], input[name*='user'], input[id*='user']"
    );

    const passInput = document.querySelector(
      "input[type='password'], input[name*='pass'], input[id*='pass']"
    );

    if (!userInput || !passInput) {
      console.log("No se encontraron inputs");
      return;
    }

    userInput.value = user;
    userInput.dispatchEvent(new Event("input", { bubbles: true }));

    passInput.value = pass;
    passInput.dispatchEvent(new Event("input", { bubbles: true }));

    setTimeout(() => {

      const btn = document.querySelector(
        "button[type='submit'], input[type='submit'], button"
      );

      if (btn) {
        btn.click();
        console.log("Login ejecutado");
      }

    }, 800);

  }

});