Feature: Navigation
  As a Parent using the application
  I want to navigate between sections of the app
  So that I can access all my records efficiently

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: Journal page loads and displays the journal heading
    Given I am on the "journal" page
    Then the journal heading should be visible

  @regression
  Scenario: Page size selector is visible when entries exist
    Given I have an existing Entry
    And I am on the "journal" page
    Then the page size selector should be visible

  @regression
  Scenario: Selecting page size 50 updates the URL parameter
    Given I have an existing Entry
    And I am on the "journal" page
    When I select page size 50
    Then the URL should contain "pageSize=50"

  @regression
  Scenario: Selecting All entries shows count text
    Given I have an existing Entry
    And I am on the "journal" page
    When I select page size all
    Then I should see "Showing all" on the page

  @regression
  Scenario: Page size selection persists when set via URL parameter
    Given I have an existing Entry
    And I am on the "journal?pageSize=10" page
    Then the URL should contain "pageSize=10"
    And the "10" page size button should be highlighted
