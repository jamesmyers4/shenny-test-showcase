Feature: Onboarding
  As a new Parent using the application
  I want to complete the onboarding flow
  So that I can set up my account before documenting

  Background:
    Given I am logged in as the test Parent

  @regression @onboarding
  Scenario: Completing the full onboarding flow redirects to the new Entry page
    Given my onboarding is not complete
    When I navigate to the onboarding page
    And I complete the onboarding flow
    Then I should see the completion screen
    When I click Create your first entry
    Then I should be on the new Entry page

  @regression @onboarding
  Scenario: Middleware redirects incomplete-onboarding users from the journal to onboarding
    Given my onboarding is not complete
    When I navigate to the journal page directly
    Then I should be redirected to the onboarding page

  @regression @onboarding
  Scenario: Onboarding resumes from the correct step on refresh
    Given my onboarding is at step 2
    When I navigate to the onboarding page
    Then I should see the children names step
