Feature: Case Access
  As a Parent using the application
  I want to grant and revoke access to Cases for professionals
  So that my legal team can review my documentation

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: Grant access form renders with all required fields
    Given I have an existing Case
    When I visit the Case access page
    And I click the Grant Access button
    Then the access email input should be visible
    And the access role selector should be visible
    And the case-scoped option should be visible
    And the full-access option should be visible
    And the exclude-entries option should be visible
    And the exclude-recordings option should be visible
    And the exclude-messages option should be visible

  @regression
  Scenario: Scope toggle changes selection between case-scoped and full access
    Given I have an existing Case
    When I visit the Case access page
    And I click the Grant Access button
    And I click the full-access scope button
    Then the full-access scope button should be selected
    When I click the case-scoped scope button
    Then the case-scoped scope button should be selected

  @regression
  Scenario: Grant form submits to the POST endpoint on confirm
    Given I have an existing Case with a mocked grant endpoint
    When I visit the Case access page
    And I click the Grant Access button
    And I fill in the access email "lawyer@example.com"
    And I submit the grant access form
    Then the grant endpoint should have been called

  @regression
  Scenario: Revoke shows inline confirmation before acting
    Given I have an existing Case with an active access grant
    When I visit the Case access page
    And I click the Revoke button
    Then I should see an "are you sure" confirmation message
    And the confirm revoke button should be visible

  @regression
  Scenario: Revoke calls the PATCH endpoint on confirm
    Given I have an existing Case with an active access grant and a mocked revoke endpoint
    When I visit the Case access page
    And I click the Revoke button
    And I click the confirm revoke button
    Then the revoke endpoint should have been called
    And I should see an access removed confirmation message
