Feature: Entry Import and Journal Pagination
  As a Parent using the application
  I want to import existing records and paginate my journal
  So that I can manage large volumes of documentation

  Background:
    Given I am logged in as the test Parent

  @regression
  Scenario: Import section is visible on the exports page
    Given I am on the exports page
    Then the import drop zone should be visible
    And the import helper text should be visible

  @regression
  Scenario: Journal page size selector shows all size options
    Given I have at least one Entry in my journal
    When I visit the journal page
    Then I should see page size options for 10, 25, 50, 100, and All

  @regression
  Scenario: Selecting page size 50 updates the URL
    Given I have at least one Entry in my journal
    When I visit the journal page
    And I select page size 50
    Then the URL should contain "pageSize=50"

  @regression
  Scenario: Selecting All page size shows a count message
    Given I have at least one Entry in my journal
    When I visit the journal page
    And I select All page size
    Then the URL should contain "pageSize=0"
    And I should see a showing-all count message

  @regression
  Scenario: Selected page size persists in URL and the active button is highlighted
    Given I have at least one Entry in my journal
    When I visit the journal page with page size 10
    Then the page size 10 button should be active
