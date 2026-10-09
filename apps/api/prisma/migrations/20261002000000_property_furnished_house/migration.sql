-- Add 'furnished_house' to the PropertyType enum (positioned after 'house').
ALTER TYPE "PropertyType" ADD VALUE IF NOT EXISTS 'furnished_house' AFTER 'house';
