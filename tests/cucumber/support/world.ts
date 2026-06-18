import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber'
import type { Browser, BrowserContext, Page } from '@playwright/test'

export interface CucumberWorld {
  browser: Browser
  context: BrowserContext
  page: Page
  baseUrl: string
  testUserEmail: string
  lastCreatedEntryId: string | null
  lastCreatedRecordingId: string | null
  lastCreatedCaseId: string | null
  lastCreatedAccessId: string | null
  lastResponseStatus: number | null
}

export class CustomWorld extends World implements CucumberWorld {
  browser!: Browser
  context!: BrowserContext
  page!: Page
  baseUrl: string
  testUserEmail: string
  lastCreatedEntryId: string | null = null
  lastCreatedRecordingId: string | null = null
  lastCreatedCaseId: string | null = null
  lastCreatedAccessId: string | null = null
  lastResponseStatus: number | null = null

  constructor(options: IWorldOptions) {
    super(options)
    this.baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
    this.testUserEmail = process.env.TEST_USER_EMAIL ?? 'e2e-test@example.com'
  }
}

setWorldConstructor(CustomWorld)
