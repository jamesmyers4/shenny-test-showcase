Feature: Settings
  As a Parent using the application
  I want to manage my account settings
  So that I can control my subscription and profile

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: Settings page shows the manage plan link
    When I navigate to the settings page
    Then I should see the manage plan link

  @regression
  Scenario: Danger zone is present on the settings page
    When I navigate to the settings page
    Then I should see the danger zone section

  @regression
  Scenario: Delete account button is disabled until DELETE is typed
    When I navigate to the settings page
    Then the delete account button should be disabled
    When I type the delete confirmation word
    Then the delete account button should be enabled

  @regression
  Scenario: Account deletion shows a confirmation message with API mocked
    When I navigate to the settings page
    And the delete user endpoint is mocked
    And I type the delete confirmation word
    And I click the delete account button
    Then I should see the account deletion scheduled message

  @regression @billing
  Scenario: Annual billing is pre-selected on the plans page
    When I navigate to the plans settings page
    Then the annual billing option should be pre-selected

  @regression @billing
  Scenario: Standard and Premium plan options are visible with pricing
    When I navigate to the plans settings page
    Then I should see Standard and Premium plan options with pricing

  @regression @billing
  Scenario: Clicking upgrade calls the mocked Stripe checkout endpoint
    When I navigate to the plans settings page
    And the Stripe checkout endpoint is mocked
    And I click the upgrade button on the plans page
    Then the Stripe checkout endpoint should have been called
