Feature: Recordings
  As a Parent using the application
  I want to upload audio Recordings
  So that I can have them transcribed and reported on

  Background:
    Given I am logged in as the test Parent

  @ai @slow @regression
  Scenario: Recording upload status progresses from UPLOADING to PENDING to COMPLETE
    When I create a new Recording via the API
    Then the Recording status should be "UPLOADING"
    When I mark the Recording upload as complete
    Then the Recording status should be "PENDING"
    When I trigger the Recording processing pipeline
    Then the Recording status should be "COMPLETE"
