Feature: Keyboard Navigation
  As a Parent using the application
  I want to navigate the app using only a keyboard
  So that I can use it without a mouse

  Background:
    Given I am logged in as the test Parent

  @keyboard @smoke @regression
  Scenario: Skip to main content link is the first focusable element
    When I navigate to the journal page for keyboard testing
    And I press Tab once
    Then the focused element should read "Skip to main content"

  @keyboard @regression
  Scenario: Skip to main content link moves focus to the main content area
    When I navigate to the journal page for keyboard testing
    And I press Tab once
    And I press Enter
    Then focus should be on the main content element

  @keyboard @regression
  Scenario: Sidebar navigation links are reachable by keyboard
    When I navigate to the journal page for keyboard testing
    Then the sidebar navigation should be reachable within 15 Tab presses

  @keyboard @regression
  Scenario: New entry form fields are keyboard operable
    When I navigate to the new entry page for keyboard testing
    Then the title field should accept keyboard input
    And the category field should be keyboard focusable

  @keyboard @regression
  Scenario: Pagination next control is keyboard focusable when visible
    When I navigate to the journal page for keyboard testing
    Then the pagination next control should be keyboard focusable if visible

  @keyboard @regression
  Scenario: Delete confirmation modal closes on Escape
    Given I am a PREMIUM plan user
    When I navigate to the journal page for keyboard testing
    Then the delete dialog should close on Escape if it is opened

  @keyboard @regression @ai
  Scenario: Clarity panel opens and closes with the keyboard
    Given I am a PREMIUM plan user
    When I navigate to the journal page for keyboard testing
    Then the Clarity panel should toggle open and closed with the keyboard if the button is present
