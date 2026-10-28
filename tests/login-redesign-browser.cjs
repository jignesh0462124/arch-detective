// prettier-ignore
async (page) => {
  const base="http://127.0.0.1:5194/tests/auth-preview/index.html";
  for(const theme of ["light","dark"]) {
    await page.goto(`${base}?theme=${theme}`);
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await page.getByRole("heading",{name:"Welcome back",exact:true}).waitFor();
      await page.getByRole("button",{name:"Show password",exact:true}).click();
      await page.getByRole("button",{name:"Hide password",exact:true}).click();
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error("Login overflow");
      await page.screenshot({path:`output/playwright/login-v2-${theme}-${width}.png`,fullPage:true});
      await page.getByRole("button",{name:"Create an account",exact:true}).click();
      await page.getByRole("textbox",{name:"Full name",exact:true}).waitFor();
      await page.getByLabel("Confirm password",{exact:true}).waitFor();
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error("Signup overflow");
      await page.screenshot({path:`output/playwright/signup-v2-${theme}-${width}.png`,fullPage:true});
      await page.getByRole("button",{name:"Sign in",exact:true}).click();
    }
  }
  await page.getByRole("button",{name:"Forgot password?",exact:true}).click();
  await page.getByRole("heading",{name:"Forgot your password?",exact:true}).waitFor();
  await page.getByRole("button",{name:"Back to sign in",exact:true}).click();
  await page.getByRole("textbox",{name:"Email address",exact:true}).fill("test@example.invalid");
  await page.getByLabel("Password",{exact:true}).fill("short");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await page.getByRole("heading",{name:"Private workspace",exact:true}).waitFor();
  console.log("PASS: Login/signup light/dark desktop/mobile, password visibility, recovery navigation and short existing password");
}
