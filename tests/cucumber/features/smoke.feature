Feature: Smoke
  As a system operator
  I want critical routes to be protected and responsive
  So that I can quickly detect regressions

  @smoke @regression
  Scenario: Cron context-snapshot endpoint rejects unauthenticated requests
    When I request the "/api/cron/context-snapshot" endpoint without a secret
    Then the response status should be 401

  @smoke @regression
  Scenario: Cron purge-deleted-users endpoint rejects unauthenticated requests
    When I request the "/api/cron/purge-deleted-users" endpoint without a secret
    Then the response status should be 401

  @smoke @regression
  Scenario: Sign-in page is accessible to unauthenticated visitors
    When I visit the path "/sign-in"
    Then the sign-in form should be visible

  @smoke @regression
  Scenario: Authenticated Parent can access the journal
    Given I am logged in as the test Parent
    When I visit the journal page
    Then the journal heading should be visible
