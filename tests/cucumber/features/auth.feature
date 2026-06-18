Feature: Authentication
  As a Parent using the application
  I want to sign in securely
  So that my records are protected

  @smoke @regression
  Scenario: Parent signs in and lands on the journal
    Given I navigate to the sign-in page
    When I complete the Clerk sign-in flow as the test Parent
    Then I should land on the journal page

  @regression
  Scenario: MFA nag banner is suppressed when the localStorage dismiss key is set
    Given I am logged in as the test Parent
    When I visit the journal page
    Then the MFA nag banner should not be visible

  @regression
  Scenario: Unauthenticated visit to a protected route redirects to sign-in
    Given I am not signed in
    When I visit the journal page
    Then I should be redirected to sign-in
