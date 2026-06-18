Feature: Insight Reports
  As a Parent using the application
  I want to view Insight Reports about my documentation
  So that I can understand patterns in my co-parenting records

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: FREE user can reach the Insight Reports page
    When I visit the Insight Reports page
    Then I should see the Insight Reports heading
    And I should not see an upgrade gate

  @regression
  Scenario: STANDARD user can reach the Insight Reports page without an upgrade gate
    Given I am a STANDARD plan user
    When I visit the Insight Reports page
    Then I should not see an upgrade gate

  @regression
  Scenario: Quarterly Report label is shown instead of the raw SCHEDULED trigger type
    Given I have a SCHEDULED InsightReport in my account
    When I visit the Insight Reports page
    Then I should see "Quarterly Report" displayed
    And I should not see "SCHEDULED" as a raw trigger type

  @regression
  Scenario: Alert Report label is shown instead of the raw VELOCITY trigger type
    Given I have a VELOCITY InsightReport in my account
    When I visit the Insight Reports page
    Then I should see "Alert Report" displayed
    And I should not see "VELOCITY" as a raw trigger type
