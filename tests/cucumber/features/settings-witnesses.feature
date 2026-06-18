Feature: Settings — Known Witnesses
  As a Parent using the application
  I want to manage a list of known witnesses in my settings
  So that the AI can use their context when they appear in my Entries

  Background:
    Given I am logged in as the test Parent

  @smoke @regression
  Scenario: Known Witnesses section is visible on the settings page
    When I navigate to the settings page
    Then I should see the Known Witnesses section

  @regression
  Scenario: Add known witness button is visible
    When I navigate to the settings page
    Then I should see the add known witness button

  @regression
  Scenario: Clicking Add shows the witness form with name and role fields
    When I navigate to the settings page
    And I click the add known witness button
    Then I should see the witness name field
    And I should see the witness role field

  @regression
  Scenario: Adding a witness with a mocked API shows the witness in the list
    When I navigate to the settings page
    And the stored witnesses endpoint is mocked for adding
    And I click the add known witness button
    And I fill in the witness name "Dr. Amy Proulx"
    And I fill in the witness role "child psychologist"
    And I submit the witness form
    Then the witness save confirmation should be shown
