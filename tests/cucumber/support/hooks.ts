import { Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'
import { CustomWorld } from './world'

setDefaultTimeout(30_000)

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
  })
  this.context = await this.browser.newContext({
    baseURL: this.baseUrl,
    viewport: { width: 1280, height: 720 },
  })
  this.page = await this.context.newPage()
})

After(async function (this: CustomWorld) {
  await this.page?.close()
  await this.context?.close()
  await this.browser?.close()
})
