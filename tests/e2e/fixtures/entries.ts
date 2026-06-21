import { faker } from '@faker-js/faker'

// Two clearly distinct events in one entry — reliably triggers EntrySplit.
export const MULTI_EVENT_SUMMARY =
  'At 3:15 PM I arrived at school to pick up Hudson. ' +
  'The teacher Mrs. Johnson told me Hudson had fallen on the playground at 1:00 PM and ' +
  'injured his knee. She showed me the bruise and noted it in the incident log. ' +
  'Then at 4:30 PM when I arrived at the agreed pickup location to return Hudson to his father, ' +
  'his father was 45 minutes late with no prior notice or communication of any kind.'

// Single-event summary — should NOT trigger EntrySplit.
export const SINGLE_EVENT_SUMMARY =
  'At the 3:15 PM school pickup Hudson appeared unusually tired and was wearing the same ' +
  'clothes he had on Friday. He said he had not had dinner the night before. ' +
  'I noted this and took a photo of his clothing as documentation.'

// Unique title to avoid the duplicate-detection check (date + title dedup).
export function uniqueTitle(prefix = 'Test entry') {
  return `${prefix} ${faker.string.alphanumeric(10)}`
}

export function buildEntryPayload(overrides?: {
  title?: string
  summary?: string
  category?: string
  entryDate?: string
}) {
  return {
    title: uniqueTitle(),
    summary: SINGLE_EVENT_SUMMARY,
    category: 'INCIDENT',
    entryDate: new Date().toISOString().split('T')[0],
    isDraft: false,
    ...overrides,
  }
}

// What the mock EntrySplit POST returns — used in page.route() intercepts.
export const MOCK_SPLIT_RESPONSE = {
  shouldSplit: true,
  events: [
    {
      title: 'Playground injury not communicated at pickup',
      narrative:
        'At 3:15 PM teacher Mrs. Johnson informed me of a playground injury at 1:00 PM. ' +
        'Hudson had fallen and injured his knee. The bruise was noted in the incident log.',
      category: 'MEDICAL',
      suggestedTone: 'NOTABLE',
    },
    {
      title: 'Father 45 minutes late to exchange — no notice',
      narrative:
        'At 4:30 PM father was 45 minutes late to the agreed pickup location. ' +
        'No prior communication or notice was given.',
      category: 'SCHEDULE',
      suggestedTone: 'CONCERNING',
    },
  ],
}

export const MOCK_NO_SPLIT_RESPONSE = { shouldSplit: false }
