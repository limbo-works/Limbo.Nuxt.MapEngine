# Scope of Work – Herningsholm Map Function

**July 1, 2026**
**Version 3** (updates since version 2 are marked in yellow)

---

## 1. User Stories

### 1.1 User

As a user, I want to be able to get a geographical overview of Herningsholm via an interactive map, so that I can orient myself and find relevant locations.

### 1.2 Editor

As an editor, I want to be able to insert dedicated maps with locations, so that I can target relevant information and help visitors orient themselves and find their way around Herningsholm.

---

## 2. Description

### 2.1 General

The map function is developed as a standalone page type that can either be inserted as an overlay on the website and opened via a dedicated map block, or accessed directly via a URL — for example from an info screen, possibly with a touch panel.

The page-type approach allows maps to be presented with maximum focus on content and information, without having to allocate valuable screen space to the website's user interface.

An arbitrary number of individual maps can be created with varying information and options, including locations (POIs – Points of Interest), floors, zoom levels, filters (layers), and tag-based search.

All maps are created and stored centrally under "Modules," from where they can be inserted into the desired context — including in more than one place. Maintenance and any corrections will take effect everywhere the map is used.

Via Umbraco's built-in user management, it will be possible to grant isolated access to selected users who should only be able to create and maintain maps under "Modules." Editor rights will still be required to insert maps on the website.

All maps are based on the base layers for the campus area on and around Lillelundvej.

Maps can be grouped into folders with the option for individual naming, making it easy to distinguish between the different maps when inserting them into context.

### 2.2 Layers

The map consists of a set of fixed base layers that form the foundation of the map itself. In addition, there are a number of optional information layers that can be toggled on and off (by the editor or the user) as needed.

#### 2.2.1 Base Layers

The base layers form the map's foundation and contain physical elements, including roads, buildings, and reference points. The base layers consist of:

- Area overview (buildings, house numbers, roads, and reference points)
- Building overview (level 1 + area divisions within buildings)
- Building details (level 2 + rooms)

#### 2.2.2 Information Layers

These can be activated editorially as needed and toggled on/off by the user in the frontend. The information layers include:

- Walking routes
- Parking areas
- Entrances

Both base and information layers are fixed and can only be updated by Limbo — but can individually be enriched with POIs editorially via Umbraco, for example to map locations for waste sorting.

The layers are implemented in SVG format and can be provided to Herningsholm so that new versions can be worked on visually, which are subsequently quality-assured and implemented by Limbo.

---

## 3. Functionality

### 3.1 Map Block

A dedicated block will be developed for the website with the option to insert an optional block title, heading, image/illustration, and a CTA linking to the desired map. If only an image/illustration is inserted, it is displayed at full width.

The specific map, previously created under "Modules," can be selected from a list containing all available maps.

### 3.2 Zoom

All maps include a zoom function, activated either via the +/− buttons in the bottom-left corner. Alternatively, zooming can be done via scroll on desktop and pinch on touch devices.

When a map is created, the editors define the starting point for the zoom level for that specific map. From there, the user can choose to zoom in or out as needed.

It is also possible to share a specific view (zoom level and active layer) with other users by copying the map's URL.

### 3.3 POI (Point of Interest)

On each map, the editor can freely create POIs belonging to a specific layer via Umbraco — for example "Area Overview" or "Parking."

Each POI is created with:

- A position
- An association with one or more buildings (optional)
- A clickable, optional title (e.g., "Carpentry Program"), or
- A clickable icon (e.g., of a waste system), or
- A non-clickable icon (e.g., of a toilet)

Icons can be selected from a pool of icons that can be uploaded and managed via Umbraco. The size of all icons is fixed.

For clickable POIs, it is possible to add a content overlay with selected blocks, or attach a link (internal, external, or to a file). If it is a clickable POI with a title, a fixed icon is inserted immediately after the title, symbolizing either a link [link icon] or an overlay [link-to-overlay icon].

Clickable POIs are presented visually as a pin, and non-clickable icons are presented without a background.

Only clickable POIs are included in search, as well as in grouping and filtering functionality.

### 3.4 Overlays

A content overlay can be attached to each POI. The overlay has a white background and "slides" in from the right side of the map. The overlay can contain the following selected content blocks from the website, in an overlay version:

- Text
- Image
- Video
- Contact persons (both versions)
- Link list

This makes it possible, for example, to describe a location, show contact persons, or link further to a registration form or similar.

### 3.5 Grouping and Filtering of POIs

POIs can be grouped across layers — for example, to group POIs related to waste sorting on the campus area and in the various buildings.

POI groups are created, like POIs, locally within a folder under a specific map.

A POI group becomes available in the frontend in the form of a filter, placed alongside the other filters for walking routes, entrances, and parking. For the sake of usability and space on the interface, the map should contain a minimum of active groups at any given time.

For each group, the number of POIs is shown in parentheses after the filter's name — for example, "Cardboard (15)."

When a filter is activated, all of the filter's POIs are presented in a list on the left side of the map. This feature exists to show both the visible and non-visible POIs across all zoom levels. When a POI on the list is clicked, it is highlighted on the map, from where it can be activated — even if it is not part of the active zoom level.

_[Image: Map with POI groups for waste sorting]_

_[Image: Assigning tags and groups in Umbraco]_

_[Video: Live example of assigning tags and groups in Umbraco]_

_[Image: Placement of groups in Umbraco]_

_[Image: Folder with groups in Umbraco]_

### 3.6 Tags

All POIs can be tagged with one or more tags. Tags are used to mark up POIs so that they become searchable in the map function's local search.

Each tag is created and maintained locally on each POI.

Tags can also be used for synonyms and alternative spellings. This means that, for example, a Danish term for "carpenter" could also be found through misspelled variants of that term. All tags, synonyms, and alternative spellings are used exclusively "behind the scenes" in the search and are not shown to the user in the search results. Here, it will always be the POI's name that is presented.

Synonyms and alternative spellings can also be used to group POIs, so that, for example, a search for "wood" includes both "Cabinetmaker" and "Carpenter" in the search results, or so that "Building 1" is part of the search results for searches such as program abbreviations associated with that building.

---

## 4. Search

The search function searches both in labels (POI names) and in tags.

The search results include both fixed (e.g., "Parking") and custom (e.g., "Carpentry Program") POIs.

The search works with auto-suggest, where POIs with labels or tags matching the entered characters are presented in a list that updates continuously as the user types. If the user selects a POI from the list, it is highlighted on the map.

_[Image: Example of map with active search]_

### 4.1 "Pseudo-Wayfinding"

When a POI is highlighted via search, a "Where are you now?" search field appears. Here, a similar search can be performed, making it possible to highlight another location together with the walking-routes layer, so that the user can orient themselves and more easily find their way from A to B.

---

## 5. Style, Tone, and Technical Proof of Concept

### 5.1 Frontend – Examples of Style and Tone

_[Image: Area overview]_

_[Image: Overlays]_

_[Image: Content overlay]_

---

## 6. Acceptance Criteria

TBD – Next step

---

## 7. Backend – Proof of Concept

_[Attachment: Backend PoC – part 1]_

_[Attachment: Backend PoC – part 2]_
