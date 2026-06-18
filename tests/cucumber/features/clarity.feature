Feature: Clarity
  As a Parent using the application
  I want to use the Clarity AI assistant
  So that I can get guidance on documenting my co-parenting situation

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: Compass button is visible on the journal new Entry page
    When I visit the new Entry page
    Then the Clarity compass button should be visible

  @regression
  Scenario: Compass button is visible on an Entry detail page
    Given I have an existing Entry
    When I visit that Entry's detail page
    Then the Clarity compass button should be visible

  @regression
  Scenario: Clarity panel opens and closes on compass click
    When I visit the new Entry page
    And I open the Clarity panel
    Then the Clarity panel should be open
    When I close the Clarity panel
    Then the Clarity panel should be closed

  @ai @slow @regression
  Scenario: New Clarity session — message sent and assistant responds
    When I visit the new Entry page
    And I open the Clarity panel
    And I start a new Clarity session
    And I send the Clarity message "What should I focus on documenting right now?"
    Then I should see a response from the Clarity assistant

  @ai @slow @regression
  Scenario: Clarity session title auto-generates after the first message exchange
    When I visit the new Entry page
    And I open the Clarity panel
    And I start a new Clarity session
    And I send the Clarity message "What should I focus on documenting right now?"
    Then the Clarity session title should be generated
