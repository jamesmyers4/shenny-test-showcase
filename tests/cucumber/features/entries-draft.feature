Feature: Entry Drafts and Form Fields
  As a Parent using the application
  I want to manage Entry draft state and form options
  So that I can document events accurately with the right metadata

  Background:
    Given I am logged in as the test Parent

  @regression
  Scenario: Draft Entry — enabling attachments creates a draft and tone evaluates on finalise
    When I create a new Entry via the draft flow with attachments enabled
    Then I should be on the Entry detail page
    And a tone badge should be visible

  @regression
  Scenario: Entry form source picker contains ParentSquare option
    Given I am on the new Entry form
    Then the source picker should contain "ParentSquare"

  @regression
  Scenario: Entry form source picker contains Personal Reflection option
    Given I am on the new Entry form
    Then the source picker should contain "Personal Reflection"

  @regression
  Scenario: Entry form source picker contains Document option
    Given I am on the new Entry form
    Then the source picker should contain "Document"

  @regression
  Scenario: Entry form source picker does not contain Verbal option
    Given I am on the new Entry form
    Then the source picker should not contain "Verbal"

  @regression
  Scenario: Entry form category picker contains Observation option
    Given I am on the new Entry form
    Then the category picker should contain "Observation"

  @regression
  Scenario: Entry form eventTime field is present
    Given I am on the new Entry form
    Then the eventTime input field should be visible

  @regression
  Scenario: Submitting with an empty eventTime field succeeds
    When I create a new Entry with an empty eventTime field
    Then I should be on the Entry detail page

  @regression
  Scenario: Submitting with eventTime "14:30" displays the time on the detail page
    When I create a new Entry with eventTime "14:30"
    Then I should be on the Entry detail page
    And the time "at 14:30" should be visible on the detail page
