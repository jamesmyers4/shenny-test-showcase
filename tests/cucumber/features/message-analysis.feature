Feature: Message Analysis
  As a Parent using the application
  I want to analyse co-parenting message threads
  So that I can understand communication patterns

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: FREE user can reach the Message Analysis page
    When I visit the Message Analysis page
    Then I should see the Analyze Message button

  @regression
  Scenario: PREMIUM user sees the Analyze Message button
    When I visit the Message Analysis page
    Then I should see the Analyze Message button

  @regression
  Scenario: Sidebar has no lock icon on the Message Analysis nav link
    When I visit the journal page
    Then the Message Analysis nav link should have exactly one icon
