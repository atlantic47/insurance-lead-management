# Insurance Lead Management System

A comprehensive NestJS backend system for managing insurance leads, communications, and client relationships with complete pipeline management.

## 🎯 Features

### ✅ **Complete Lead Management Pipeline**
- **Multi-channel Lead Creation**: Website, API, chatbot, email, WhatsApp, social media, referrals
- **Full Sales Pipeline**: NEW → CONTACTED → ENGAGED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → CLOSED_WON/CLOSED_LOST → FOLLOW_UP
- **Automated Pipeline Management**: Auto-task creation, stage transition tracking, conversion metrics
- **Lead Scoring**: Automatic and manual scoring with configurable criteria
- **Lead Assignment**: Role-based lead assignment and management

### ✅ **Advanced Pipeline Features**
- **Pipeline View**: Complete visual pipeline with lead counts per stage
- **Stage Transitions**: Move leads between stages with notes and automatic task creation
- **Pipeline Metrics**: Conversion funnel analysis, average time per stage
- **Auto-Follow-ups**: Automatic task creation based on pipeline stage transitions

### ✅ **Communication Management**
- **Multi-channel Communications**: Email, WhatsApp, phone, SMS, in-app messaging, social media
- **Communication History**: Full conversation threading and history
- **Message Templates**: Reusable communication templates per channel
- **Read/Unread Tracking**: Message status tracking and notifications
- **Communication Analytics**: Channel effectiveness and response metrics

### ✅ **AI-Powered Features**
- **Chatbot Integration**: Public chatbot endpoint for website integration
- **Auto-Response Generation**: AI-powered response suggestions
- **Sentiment Analysis**: Communication sentiment tracking
- **Lead Escalation**: Automatic escalation to human agents
- **AI Conversation Logs**: Complete AI interaction history

### ✅ **Product & Client Management**
- **Product Catalog**: Complete CRUD for insurance products (Life, Health, Auto, Home, Business, Travel)
- **Smart Recommendations**: AI-powered product recommendations based on lead profiles
- **Client Conversion**: Seamless lead-to-client conversion process
- **Policy Management**: Policy tracking, renewals, commissions
- **Client Analytics**: Conversion rates, policy distribution, renewal tracking

### ✅ **Task & Activity Management**
- **Smart Task Creation**: Automatic task creation based on pipeline stages
- **Task Types**: Follow-ups, calls, meetings, emails, proposals
- **Priority Management**: 5-level priority system with due date tracking
- **Task Analytics**: Completion rates, overdue tasks, upcoming activities

### ✅ **Comprehensive Reporting**
- **Lead Conversion Reports**: Detailed conversion analysis and funnels
- **Agent Performance**: Individual and team performance metrics
- **Communication Effectiveness**: Channel performance and response analytics
- **Pipeline Analytics**: Stage progression and bottleneck identification
- **Export Capabilities**: CSV export for all report types

### ✅ **Security & Authentication**
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: ADMIN, MANAGER, AGENT roles with specific permissions
- **Password Security**: bcrypt hashing with configurable rounds
- **Audit Logging**: Complete action tracking and audit trails

### ✅ **API Documentation & Testing**
- **Complete Swagger Documentation**: Auto-generated API documentation
- **Pre-filled Test Examples**: All DTOs include realistic example data
- **Interactive Testing**: Swagger UI for easy API testing
- **Comprehensive Validation**: Input validation with detailed error messages

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Installation

1. **Clone and Install Dependencies**
```bash
npm install
```

2. **Configure Environment**
```bash
# Update .env file with your database credentials
DATABASE_URL="mysql://username:password@localhost:3306/insurance_lead_db"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=3001
```

3. **Setup Database**
```bash
# Push schema to database
npm run prisma:push

# Generate Prisma client
npm run prisma:generate

# Seed with sample data
npm run prisma:seed
```

4. **Start Application**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build && npm run start:prod
```

## 📚 API Documentation

- **Swagger UI**: http://localhost:3001/api
- **Complete Documentation**: Interactive API documentation with examples
- **Test Credentials**:
  - Admin: `admin@insurance.com` / `admin123`
  - Manager: `manager@insurance.com` / `admin123`
  - Agent: `agent1@insurance.com` / `admin123`

## 🔧 Key Endpoints

### Pipeline Management
- `GET /leads/pipeline/view` - Complete pipeline view
- `GET /leads/pipeline/metrics` - Pipeline performance metrics
- `PATCH /leads/:id/pipeline/move` - Move lead to different stage

### Lead Management
- `POST /leads` - Create new lead (with pre-filled examples)
- `GET /leads` - List leads with advanced filtering
- `PATCH /leads/:id/score` - Update lead score
- `POST /leads/:id/convert` - Convert lead to client

### Communication
- `POST /communications` - Create communication (with examples)
- `GET /communications/templates` - Get message templates
- `GET /communications/lead/:leadId` - Get lead communication history

### AI Features
- `POST /ai/chatbot` - Public chatbot endpoint
- `POST /ai/auto-response/:leadId` - Generate AI response
- `POST /ai/sentiment/:leadId` - Analyze communication sentiment

### Analytics & Reports
- `GET /reports/lead-conversion` - Conversion analytics
- `GET /reports/agent-performance` - Agent performance metrics
- `GET /reports/pipeline-analytics` - Pipeline analysis

## 💾 Sample Data

The system includes comprehensive sample data:
- **4 Users**: Admin, Manager, 2 Agents
- **4 Insurance Products**: Life, Health, Auto, Home
- **3 Sample Leads**: Various pipeline stages
- **Communication History**: Multi-channel examples
- **Tasks & Activities**: Scheduled follow-ups
- **1 Converted Client**: Complete conversion example

## 🏗️ Architecture

### Technology Stack
- **Backend**: NestJS with TypeScript
- **Database**: MySQL with Prisma ORM
- **Authentication**: JWT with role-based access
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator with comprehensive rules

### Module Structure
```
src/
├── auth/           # Authentication & authorization
├── users/          # User management
├── leads/          # Lead & pipeline management
├── communications/ # Multi-channel messaging
├── products/       # Product catalog & recommendations
├── clients/        # Client & policy management
├── tasks/          # Task & activity management
├── ai/             # AI integration endpoints
├── reports/        # Analytics & reporting
└── common/         # Shared utilities & services
```

### Database Schema
- **9 Core Entities**: Optimized relationships
- **Comprehensive Enums**: Status tracking and categorization
- **Audit Trails**: Complete action logging
- **Performance Optimized**: Indexed queries and efficient joins

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-Based Access**: Granular permission system
- **Input Validation**: Comprehensive data validation
- **Password Hashing**: bcrypt with salt rounds
- **Audit Logging**: Complete action tracking
- **Error Handling**: Secure error responses

## 📈 Analytics & Metrics

- **Real-time Pipeline Metrics**: Live conversion tracking
- **Performance Analytics**: Agent and team performance
- **Communication Insights**: Channel effectiveness
- **Custom Reports**: Flexible reporting with date ranges
- **Export Capabilities**: CSV export for all reports

## 🔧 Customization

The system is highly customizable:
- **Pipeline Stages**: Easily modify sales pipeline stages
- **Product Types**: Add new insurance product categories
- **Communication Channels**: Extend with new channels
- **AI Integration**: Replace mock AI with real services
- **Custom Fields**: Extend entities with additional fields

## 🚢 Production Ready

- **Environment Configuration**: Flexible env-based config
- **Error Handling**: Comprehensive error management
- **Logging**: Structured logging ready
- **Performance**: Optimized queries and pagination
- **Scalability**: Modular architecture for growth

## 📞 Support

For questions or issues:
1. Check the Swagger documentation at `/api`
2. Review the sample data and test endpoints
3. Examine the comprehensive DTOs with examples
4. Test the pipeline management features

---

**Built with ❤️ using NestJS, Prisma, and MySQL**
