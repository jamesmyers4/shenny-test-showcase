Feature: Dashboard
  As a Parent using the application
  I want to see an overview of my documentation
  So that I can track patterns in my co-parenting records

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: Dashboard page loads with a primary heading
    When I navigate to the dashboard
    Then the dashboard should have a primary heading

  @regression @billing
  Scenario: FREE Parent sees "Free" in the sidebar plan badge
    Given I am a FREE plan user
    When I visit the journal page
    Then I should see the sidebar plan badge showing "Free"

  @regression @billing
  Scenario: PREMIUM Parent sees "Premium" in the sidebar plan badge
    Given I am a PREMIUM plan user
    When I visit the journal page
    Then I should see the sidebar plan badge showing "Premium"
