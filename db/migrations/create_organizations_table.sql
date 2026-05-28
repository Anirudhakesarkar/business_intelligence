CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,

    organization_name VARCHAR(200) NOT NULL,
    organization_code VARCHAR(50) NOT NULL UNIQUE,

    industry_type VARCHAR(100) NOT NULL,
    business_type VARCHAR(100) NULL,

    website VARCHAR(255) NULL,

    registered_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    pincode VARCHAR(20) NOT NULL,

    gst_number VARCHAR(30) NULL,
    pan_number VARCHAR(20) NULL,

    primary_contact_name VARCHAR(150) NOT NULL,
    primary_contact_mobile VARCHAR(20) NOT NULL,
    primary_contact_email VARCHAR(150) NOT NULL,

    billing_contact_name VARCHAR(150) NULL,
    billing_contact_mobile VARCHAR(20) NULL,
    billing_contact_email VARCHAR(150) NULL,

    organization_status VARCHAR(30) NOT NULL DEFAULT 'Draft',

    remarks TEXT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NULL,

    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL
);

CREATE INDEX idx_organizations_name ON organizations (organization_name);
CREATE INDEX idx_organizations_code ON organizations (organization_code);
CREATE INDEX idx_organizations_status ON organizations (organization_status);
CREATE INDEX idx_organizations_industry ON organizations (industry_type);
CREATE INDEX idx_organizations_city_state ON organizations (city, state);
CREATE INDEX idx_organizations_active_deleted ON organizations (is_active, is_deleted);
