Feature: Billing
  As a Parent using the application
  I want to manage my subscription plan
  So that I can access the right features for my needs

  Background:
    Given I am logged in as the test Parent

  @smoke @regression @billing
  Scenario: FREE user sees all three tier cards on the plans page
    Given I am a FREE plan user
    When I navigate to the billing plans page
    Then I should see the Free Standard and Premium tier cards

  @regression @billing
  Scenario: Plans page shows current-period usage and top-up entry points
    Given I am a FREE plan user
    When I navigate to the billing plans page
    Then I should see current period usage information
    And I should see a top-up entry point

  @regression @billing
  Scenario: Stripe success banner appears when redirected with success=true
    When I navigate to the billing plans page with "success=true"
    Then I should see the subscription success banner

  @regression @billing
  Scenario: No-change note appears when redirected with canceled=true
    Given I am a FREE plan user
    When I navigate to the billing plans page with "canceled=true"
    Then I should see the no-change note

  @regression @billing
  Scenario: Annual billing is pre-selected on the plans page
    When I navigate to the billing plans page
    Then the annual billing toggle should be pre-selected

  @regression @billing
  Scenario: FREE user sees the paid-feature upgrade lock on the analyze surface
    Given I am a FREE plan user
    When I navigate to the message analysis analyze page
    Then I should see the paid-feature upgrade lock
    And I should see the see plans link

  @regression @billing
  Scenario: FREE user sees the Cases upgrade state instead of Cases data
    Given I am a FREE plan user
    When I navigate to the cases page
    Then I should see the Cases upgrade state
    And I should see the see plans link on the cases page

  @regression @billing
  Scenario: PREMIUM user sees the Clarity button on the journal
    Given I am a PREMIUM plan user
    When I visit the journal page
    Then I should see the Clarity button
