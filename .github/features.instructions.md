# Hidden Shelf - Complete Feature Documentation

This document provides a comprehensive overview of all features, functionality, and technical details in the current Hidden Shelf implementation. This serves as a migration reference for rebuilding the project with a modern structure.

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Authentication System](#authentication-system)
3. [User Interface Components](#user-interface-components)
4. [Link Management](#link-management)
5. [Category System](#category-system)
6. [Tag System](#tag-system)
7. [Sharing & Collaboration](#sharing--collaboration)
8. [Import/Export Features](#importexport-features)
9. [Theming & Customization](#theming--customization)
10. [Database Schema](#database-schema)
11. [API Endpoints](#api-endpoints)
12. [Public Link Viewing](#public-link-viewing)
13. [Security Features](#security-features)
14. [Configuration](#configuration)

## Core Architecture

### Tech Stack

- **Backend**: PHP 8.x with PDO for database operations
- **Database**: SQLite with migration system
- **Frontend**: Alpine.js for reactivity, Tailwind CSS for styling
- **Authentication**: Magic link email authentication (passwordless)
- **Session Management**: PHP sessions with configurable lifetime

### File Structure

```
├── api/                    # Backend API endpoints
├── db/                     # Database and migrations
├── lib/                    # Core PHP utilities
├── public/                 # Frontend files
├── config.php              # Configuration
└── .htaccess              # URL routing
```

## Authentication System

### Magic Link Authentication

- **Email-based login**: No passwords required
- **One-time tokens**: 15-minute expiry for security
- **Session persistence**: 30-day session lifetime
- **Google OAuth integration**: Alternative login method
- **Return URL support**: Redirect users after login

### Key Features

- Remember email addresses on device
- Welcome back flow for returning users
- Share code handling during login flow
- Beta service disclaimer and data retention warnings
- Automatic session validation on app load

### Implementation Files

- [`api/auth.php`](api/auth.php) - Authentication endpoints
- [`lib/Auth.php`](lib/Auth.php) - Authentication utilities
- [`public/login.html`](public/login.html) - Login interface

## User Interface Components

### Main Navigation

- **View Mode**: Browse links in organized categories
- **Edit Mode**: Manage, reorder, and organize links
- **Dashboard**: Overview with statistics and quick actions
- **Profile**: Settings and account management

### Layout Structure

- Responsive design with mobile-first approach
- Dark/light theme toggle
- Sticky navigation with mode switching
- Profile avatar with user initials

### Core Views

#### Dashboard (`viewMode === 'dashboard'`)

- Welcome message with user greeting
- Statistics grid (total links, categories, tags)
- Quick action buttons
- Recent activity overview

#### View Mode (`viewMode === 'view'`)

- Category-organized link display
- Collapsible category sections
- Tag filtering and search
- Pagination with "Load More" functionality
- Public link sharing buttons

#### Edit Mode (`viewMode === 'edit'`)

- Full CRUD operations for links
- Drag-and-drop reordering
- Bulk operations support
- Link position management
- Category and tag management

#### Profile (`viewMode === 'profile'`)

- User settings and preferences
- Theme customization
- Data management tools
- Import/export functionality
- Danger zone for data deletion

## Link Management

### Core Link Properties

- **URL**: Target destination (required)
- **Title**: Display name (required)
- **Description**: Optional detailed description
- **Icon**: Material Design Icons support
- **Category**: Single category assignment
- **Tags**: Multiple tag assignment
- **Public/Private**: Visibility setting
- **Direct Redirect**: Skip preview page option
- **Display Order**: Custom positioning

### Link Operations

- **Create**: Add new links with full metadata
- **Read**: View links with filtering and search
- **Update**: Edit all link properties
- **Delete**: Remove links with confirmation
- **Reorder**: Move links up/down in display order
- **Duplicate**: Copy existing links
- **Bulk Edit**: Mass operations on multiple links

### Link Display Features

- **Grid Layout**: Card-based responsive display
- **List Layout**: Compact row-based display
- **Category Grouping**: Links organized by category
- **Search**: Real-time text search across titles/descriptions
- **Filtering**: Filter by category or tag
- **Pagination**: Configurable items per page

### Public Link Sharing

- **Unique Hash Generation**: Each link gets unique identifier
- **Preview Page**: Default landing page with metadata
- **Direct Redirect**: Optional immediate redirect
- **Visit Tracking**: Analytics for public link usage
- **Share URL Format**: `/h/{hash}` short URLs

## Category System

### Category Features

- **Name**: Category display name
- **Icon**: Material Design Icons
- **Color**: Custom color coding
- **Default Redirect**: Auto-apply direct redirect to new links
- **Link Count**: Automatic counting of contained links
- **Display Order**: Custom category ordering

### Category Operations

- **Create**: Add new categories with customization
- **Edit**: Modify all category properties
- **Delete**: Remove categories (links become uncategorized)
- **Share**: Share categories with other users
- **Filter**: View links by category

### Special Categories

- **Uncategorized**: Automatic category for unassigned links
- **Shared Categories**: Categories shared by other users

## Tag System

### Tag Properties

- **Name**: Tag identifier (unique per user)
- **Usage Count**: Number of links using the tag
- **User-scoped**: Tags are private to each user

### Tag Operations

- **Create**: Add new tags via link editing
- **Assign**: Multi-select tag assignment to links
- **Remove**: Delete tags with usage confirmation
- **Filter**: View links by tag
- **Bulk Apply**: Add tags to multiple links

### Tag Display

- **Link Cards**: Show up to 3 tags, with "+N more" indicator
- **Tag Input**: Comma-separated tag entry
- **Tag Management**: Dedicated interface for tag operations

## Sharing & Collaboration

### Category Sharing System

- **Share Code Generation**: Unique codes for category access
- **Public Share Links**: URLs with embedded share codes
- **Member Management**: Add/remove users from shared categories
- **Permission Model**: Read-only access to shared content

### Share Workflow

1. **Create Share**: Generate unique share code
2. **Send Invitation**: Share URL with other users
3. **Accept Share**: Recipients join through login
4. **Access Content**: Shared categories appear in recipient's interface

### Share Management

- **View Members**: See all users with access
- **Remove Members**: Revoke individual access
- **Delete Share**: Remove sharing entirely
- **Leave Shared**: Users can leave shared categories

### Share Code Features

- **URL Detection**: Auto-extract codes from full URLs
- **Verification**: Preview category before joining
- **Login Integration**: Handle share codes during authentication

## Import/Export Features

### Export Functionality

- **JSON Format**: Complete data export
- **Includes**: Links, categories, tags with relationships
- **User Data**: Full user dataset export
- **Filename**: Timestamped export files

### Import Functionality

- **JSON Upload**: Import from exported data
- **Validation**: Comprehensive data validation
- **Duplicate Handling**: Smart duplicate detection
- **Progress Tracking**: Real-time import progress
- **Preview Mode**: Review changes before applying

### Bulk Operations

- **Data Validation**: URL validation, required fields
- **Relationship Mapping**: Maintain category/tag relationships
- **Error Handling**: Report and skip invalid entries
- **Statistics**: Show import results summary

### Supported Data

```json
{
  "links": [...],      // Link objects with metadata
  "categories": [...], // Category definitions
  "tags": [...]        // Tag definitions
}
```

## Theming & Customization

### Theme System

- **Light Theme**: Default bright appearance
- **Dark Theme**: Dark mode with custom color scheme
- **Auto-detection**: Respect system preferences
- **Persistence**: Remember user choice in localStorage

### Brand Customization

- **Primary Color**: Customizable brand color
- **Color Generation**: Auto-generate color variants
- **CSS Variables**: Dynamic color application
- **Reset Option**: Return to default colors

### Visual Customization

- **Icons**: Material Design Icons throughout
- **Typography**: Consistent font sizing and weights
- **Spacing**: Tailwind CSS spacing system
- **Animations**: Smooth transitions and hover effects

## Database Schema

### Core Tables

#### Users

- `id` - Primary key
- `email` - Unique email address
- `created_at` - Registration timestamp

#### Links

- `id` - Primary key
- `user_id` - Owner reference
- `hash` - Public identifier
- `url` - Target URL
- `title` - Display title
- `description` - Optional description
- `icon` - Icon identifier
- `display_order` - Custom ordering
- `is_public` - Public visibility flag
- `direct_redirect` - Skip preview flag
- `category_id` - Category assignment
- `metadata` - JSON flexible data
- `created_at` / `updated_at` - Timestamps

#### Categories

- `id` - Primary key
- `user_id` - Owner reference
- `name` - Category name
- `icon` - Icon identifier
- `color` - Color code
- `direct_redirect_default` - Default redirect setting
- `created_at` - Creation timestamp

#### Tags

- `id` - Primary key
- `user_id` - Owner reference
- `name` - Tag name
- `created_at` - Creation timestamp

#### Link_Tags (Many-to-Many)

- `link_id` - Link reference
- `tag_id` - Tag reference

#### Category_Shares

- `id` - Primary key
- `category_id` - Shared category
- `share_code` - Unique share identifier
- `created_by` - Share creator
- `expires_at` - Optional expiration
- `created_at` - Creation timestamp

#### Category_Share_Members

- `id` - Primary key
- `category_id` - Shared category
- `user_id` - Member user
- `accepted_at` - Join timestamp

#### Link_Visits

- `id` - Primary key
- `link_id` - Visited link
- `visited_at` - Visit timestamp
- `ip_masked` - Privacy-masked IP
- `user_agent` - Browser information
- `browser` / `os` - Parsed user agent
- `referer` - Referring URL

#### Magic_Tokens

- `id` - Primary key
- `email` - Target email
- `token` - One-time token
- `expires_at` - Token expiration
- `used` - Usage flag
- `created_at` - Creation timestamp

#### User_Settings

- `id` - Primary key
- `user_id` - User reference
- `settings` - JSON settings object

### Migration System

- Sequential SQL migration files in [`db/migrations/`](db/migrations/)
- Automatic execution on first access
- Version tracking in `_meta` table

## API Endpoints

### Authentication (`/api/auth.php`)

- `POST ?action=login` - Send magic link
- `GET ?action=verify&token=X` - Verify and login
- `GET ?action=me` - Current user info
- `POST ?action=logout` - Logout user

### Links (`/api/links.php`)

- `GET` - List user's links (with pagination)
- `POST` - Create new link
- `GET ?id=X` - Get specific link
- `PUT ?id=X` - Update link
- `DELETE ?id=X` - Delete link
- `GET ?hash=X` - Get public link by hash
- `GET ?search=X` - Search links

### Categories (`/api/categories.php`)

- `GET` - List user's categories
- `POST` - Create category
- `PUT ?id=X` - Update category
- `DELETE ?id=X` - Delete category

### Tags (`/api/tags.php`)

- `GET` - List user's tags
- `POST` - Create tag
- `DELETE ?id=X` - Delete tag

### Category Shares (`/api/category_shares.php`)

- `GET ?category_id=X` - Get share info
- `POST` - Create share or accept invitation
- `DELETE ?category_id=X` - Remove sharing
- `DELETE ?category_id=X&member_id=Y` - Remove member
- `GET ?code=X` - Verify share code
- `GET` - List shared categories

### Link Visits (`/api/link_visits.php`)

- `POST` - Log link visit
- `GET ?link_id=X` - Get visit statistics

### User Settings (`/api/user_settings.php`)

- `GET` - Get user settings
- `PUT` - Update user settings

### Configuration (`/api/config.php`)

- `GET` - Get public app configuration

## Public Link Viewing

### View Interface ([`public/view.html`](public/view.html))

- **Link Preview**: Display link metadata before redirect
- **Direct Redirect**: Optional immediate redirect
- **Visit Logging**: Track access for analytics
- **Error Handling**: Invalid/private link messages
- **Mobile Optimized**: Responsive design

### URL Routing

- **Short URLs**: `/h/{hash}` format via `.htaccess`
- **Full URLs**: `/public/view.html?hash={hash}`
- **Hash Validation**: Verify hash exists and is public

### Redirect Logic

- **Direct Redirect**: Immediate redirect if enabled
- **Preview Page**: Show metadata with redirect button
- **Analytics**: Log visit before redirect

## Security Features

### Data Protection

- **SQL Injection Prevention**: Prepared statements throughout
- **XSS Protection**: Output escaping and Content Security Policy
- **CSRF Protection**: Token validation on state-changing operations
- **Session Security**: Secure session configuration

### Privacy Features

- **IP Masking**: Partial masking for visit logs
- **Email Security**: Secure token generation
- **Data Isolation**: User scoped data access
- **Private by Default**: Links private unless explicitly made public

### Authentication Security

- **One-time Tokens**: Magic links expire after single use
- **Time-limited**: 15-minute token expiration
- **Secure Generation**: Cryptographically secure token generation
- **Session Hijacking Protection**: Session validation

## Configuration

### Environment Settings ([`config.php`](config.php))

- **Database**: SQLite file path
- **Site Settings**: URL, name, and branding
- **Email Configuration**: SMTP settings for magic links
- **Security Settings**: Session and token configuration
- **Feature Flags**: Debug mode, signup enabled
- **Pagination**: Default items per page

### User Settings

- **Links Per Page**: Configurable pagination (10-100)
- **Brand Color**: Custom theme color
- **Stored in Database**: User-specific preferences

### Development Configuration

- **Debug Mode**: Detailed error reporting
- **Docker Support**: Complete containerization
- **CSS Building**: Tailwind CSS compilation
- **Hot Reload**: Development file watching

## UI/UX Features

### Interaction Patterns

- **Long Press**: Mobile context menu for links
- **Drag and Drop**: Category scrolling and reordering
- **Keyboard Navigation**: Accessible interaction
- **Toast Notifications**: Success/error feedback
- **Modal System**: Overlay interfaces for forms

### Responsive Design

- **Mobile First**: Touch-friendly interface
- **Tablet Optimized**: Medium screen layouts
- **Desktop Enhanced**: Full feature access
- **Progressive Enhancement**: Works without JavaScript

### Accessibility

- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast**: WCAG compliant color ratios
- **Focus Indicators**: Clear focus states

### Performance Optimizations

- **Lazy Loading**: Pagination for large datasets
- **Efficient Queries**: Optimized database operations
- **Minimal Dependencies**: Lightweight frontend stack
- **Caching**: Appropriate HTTP caching headers

## Data Flow Patterns

### State Management

- **Alpine.js Reactivity**: Component-based state
- **Local Storage**: Theme and preference persistence
- **Session Storage**: Temporary navigation state
- **Database Sync**: Real-time data updates

### API Communication

- **RESTful Design**: Standard HTTP methods
- **JSON Communication**: Structured data exchange
- **Error Handling**: Consistent error responses
- **Loading States**: User feedback during operations

### File Organization

- **Single Page Apps**: Main interface in [`public/index.html`](public/index.html)
- **Separated Concerns**: Login, view, and main app
- **Shared Styles**: Single Tailwind CSS build
- **Component Logic**: Inline Alpine.js components
