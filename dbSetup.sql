CREATE USER IF NOT EXISTS 'randomapi'@'localhost' IDENTIFIED BY 'randomapi';
CREATE DATABASE IF NOT EXISTS randomapi;
USE randomapi;
GRANT ALL PRIVILEGES ON randomapi TO 'randomapi'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
-- phpMyAdmin SQL Dump
-- version 4.6.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jun 12, 2016 at 10:27 PM
-- Server version: 5.7.13
-- PHP Version: 5.5.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `randomapi`
--

-- --------------------------------------------------------

--
-- Table structure for table `API`
--

CREATE TABLE IF NOT EXISTS `API` (
  `id` int(11) NOT NULL,
  `ref` varchar(8) NOT NULL,
  `name` varchar(32) NOT NULL,
  `generator` tinyint(4) NOT NULL,
  `owner` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `Generator`
--

CREATE TABLE IF NOT EXISTS `Generator` (
  `id` int(11) NOT NULL,
  `version` varchar(8) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `Generator`
--

INSERT INTO `Generator` (`id`, `version`) VALUES
(1, '0.1');

-- --------------------------------------------------------

--
-- Table structure for table `List`
--

CREATE TABLE IF NOT EXISTS `List` (
  `id` int(11) NOT NULL,
  `ref` varchar(8) NOT NULL,
  `name` varchar(32) NOT NULL,
  `owner` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `User`
--

CREATE TABLE IF NOT EXISTS `User` (
  `id` int(11) NOT NULL,
  `username` varchar(16) NOT NULL,
  `password` varchar(64) NOT NULL,
  `apikey` varchar(16) NOT NULL,
  `role` tinyint(4) NOT NULL DEFAULT '4',
  `tier` tinyint(4) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `API`
--
ALTER TABLE `API`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ref` (`ref`);

--
-- Indexes for table `Generator`
--
ALTER TABLE `Generator`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `version` (`version`);

--
-- Indexes for table `List`
--
ALTER TABLE `List`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ref` (`ref`);

--
-- Indexes for table `User`
--
ALTER TABLE `User`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `API`
--
ALTER TABLE `API`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT for table `Generator`
--
ALTER TABLE `Generator`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
--
-- AUTO_INCREMENT for table `List`
--
ALTER TABLE `List`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT for table `User`
--
ALTER TABLE `User`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
