Feature: Entries
  As a Parent using the application
  I want to create journal Entries
  So that I can document important co-parenting events

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: New Entry is created and tone evaluates on its detail page
    When I create a new Entry
    Then I should be on the Entry detail page
    And a tone badge should be visible

  @regression
  Scenario: Multi-event Entry split preview — confirming creates separate Entries
    When I create a new multi-event Entry
    Then I should see the split preview modal
    When I confirm the split
    Then I should be on the Entry detail page
    And the Entry title should match the first proposed split event

  @regression
  Scenario: Multi-event Entry split preview — dismissing preserves the original Entry
    When I create a new Entry titled "Dismiss test" with a multi-event summary
    Then I should see the split preview modal
    When I dismiss the split
    Then I should be on the Entry detail page
    And the Entry title should contain "Dismiss test"
