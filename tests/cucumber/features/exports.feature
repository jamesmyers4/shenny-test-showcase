Feature: Exports
  As a Parent using the application
  I want to export my records
  So that I can share documentation with legal counsel or archive my data

  Background:
    Given I am logged in as the test Parent
    And I am a PREMIUM plan user

  @smoke @regression @billing
  Scenario: Exports page shows optional date labels
    When I navigate to the exports page
    Then I should see the Start Date optional label
    And I should see the End Date optional label

  @regression @billing
  Scenario: Export All button is present on the exports page
    When I navigate to the exports page
    Then I should see the Export All button

  @regression @billing
  Scenario: Export helper text is visible and contains the expected copy
    When I navigate to the exports page
    Then I should see the export helper text containing "Leave dates empty to export your complete record."

  @regression @billing
  Scenario: Export All submits without date filters
    When I navigate to the exports page
    And the export API is mocked
    And I click the Export All button
    Then the export API should be called without date filters

  @regression @billing
  Scenario: XLSX format is pre-selected on the exports page
    When I navigate to the exports page
    Then the XLSX format option should be pre-selected

  @regression @billing
  Scenario: Clicking export submit triggers the mocked export endpoint
    When I navigate to the exports page
    And the export API is mocked
    And I click the export submit button
    Then the export API should be called

  @regression @billing @slow
  Scenario: Loading state appears while the export is being prepared
    When I navigate to the exports page
    And the export API is mocked with a delay
    And I click the export submit button
    Then I should see the building your export message

  @regression @billing
  Scenario: Download link appears after a successful export
    When I navigate to the exports page
    And the export API is mocked
    And I click the export submit button
    Then I should see the export download link
