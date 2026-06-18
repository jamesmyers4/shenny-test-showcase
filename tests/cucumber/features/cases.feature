Feature: Cases (Professional Access)
  As a Parent using the application
  I want to control professional read-only access to my records
  So that I can safely share documentation with my legal team

  Background:
    Given I am logged in as the test Parent

  @regression
  Scenario: Edit and Delete buttons are hidden when the account is in read-only mode
    Given I have an existing Entry
    And my account is set to read-only mode
    When I visit that Entry's detail page
    Then the edit Entry button should not be visible
    And the delete Entry button should not be visible

  @regression
  Scenario: New Entry button is hidden when the account is in read-only mode
    Given my account is set to read-only mode
    When I visit the journal page
    Then the new Entry button should not be visible

  @regression
  Scenario: Navigating to the new Entry route redirects a read-only account to the journal
    Given my account is set to read-only mode
    When I navigate to the new Entry page
    Then I should be redirected to the journal

  @regression
  Scenario: Normal user sees the edit Entry button on an Entry detail page
    Given my account is in normal mode
    And I have an existing Entry
    When I visit that Entry's detail page
    Then the edit Entry button should be visible
