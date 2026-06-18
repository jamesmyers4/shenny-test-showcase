Feature: Accessibility
  As a Parent using the application
  I want all pages to meet WCAG 2.1 AA standards
  So that every user can access their co-parenting records

  Background:
    Given I am logged in as the test Parent
    And I am a PREMIUM plan user

  @a11y @regression
  Scenario: Every app page has exactly one h1 element
    Then every app page should have exactly one h1

  @a11y @regression
  Scenario: The html element declares the English language
    When I navigate to the journal page for a11y
    Then the html element should have lang set to "en"

  @a11y @regression
  Scenario: All images on the journal page have alt text
    When I navigate to the journal page for a11y
    Then all images should have alt text

  @a11y @regression
  Scenario: Journal list page has no WCAG violations
    When I navigate to the journal page for a11y
    Then the page should have no WCAG violations

  @a11y @regression
  Scenario: New entry form has no WCAG violations
    When I visit the path "/journal/new"
    Then the page should have no WCAG violations

  @a11y @regression
  Scenario: Recordings list has no WCAG violations
    When I navigate to the recordings page for a11y
    Then the page should have no WCAG violations excluding ".bg-green-50"

  @a11y @regression
  Scenario: Message analysis list has no WCAG violations
    When I visit the path "/message-analysis"
    Then the page should have no WCAG violations

  @a11y @regression
  Scenario: Message analysis form has no WCAG violations
    When I visit the path "/message-analysis/analyze"
    Then the page should have no WCAG violations

  @a11y @regression
  Scenario: Insight reports list has no WCAG violations
    When I visit the path "/insight-reports"
    Then the page should have no WCAG violations

  @a11y @regression
  Scenario: Settings page has no WCAG violations excluding color-contrast
    When I visit the path "/settings"
    Then the page should have no WCAG violations excluding color-contrast

  @a11y @regression
  Scenario: Billing plans page has no WCAG violations excluding color-contrast
    When I visit the path "/settings/plans"
    Then the page should have no WCAG violations excluding color-contrast

  @a11y @regression
  Scenario: Exports page has no WCAG violations
    When I visit the path "/exports"
    Then the page should have no WCAG violations

  @a11y @regression
  Scenario: Cases list has no WCAG violations
    When I visit the path "/cases"
    Then the page should have no WCAG violations

  @a11y @regression
  Scenario: Dashboard page has no WCAG violations excluding color-contrast
    When I visit the path "/dashboard"
    Then the page should have no WCAG violations excluding color-contrast

  @a11y @regression
  Scenario: Dynamic status regions use aria-live
    When I visit the path "/exports"
    Then dynamic status regions should use aria-live

  @a11y @regression
  Scenario: Page titles are descriptive
    Then each key page should have a descriptive title

  @a11y @regression
  Scenario: Icon-only buttons have an accessible name on the journal page
    When I navigate to the journal page for a11y
    Then all icon-only buttons should have an accessible name

  @a11y @regression
  Scenario: Form inputs with an id have an associated label on the new entry form
    When I visit the path "/journal/new"
    Then all form inputs with an id should have an associated label
