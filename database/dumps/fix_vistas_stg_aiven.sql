SET SESSION sql_require_primary_key = 0;

DROP VIEW IF EXISTS `vw_stg_pozos_match`;
DROP VIEW IF EXISTS `vw_stg_pozos_consolidado`;
DROP VIEW IF EXISTS `vw_stg_pdt_vigente`;
DROP VIEW IF EXISTS `vw_stg_mapa_normalizado`;
DROP VIEW IF EXISTS `vw_stg_bomba_actual`;

DROP TABLE IF EXISTS `vw_stg_pozos_match`;
DROP TABLE IF EXISTS `vw_stg_pozos_consolidado`;
DROP TABLE IF EXISTS `vw_stg_pdt_vigente`;
DROP TABLE IF EXISTS `vw_stg_mapa_normalizado`;
DROP TABLE IF EXISTS `vw_stg_bomba_actual`;

CREATE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `vw_stg_bomba_actual` AS
SELECT
  `b`.`id` AS `id`,
  `b`.`lote_carga` AS `lote_carga`,
  `b`.`origen_archivo` AS `origen_archivo`,
  `b`.`firestore_doc_id` AS `firestore_doc_id`,
  `b`.`codigo_pozo_original` AS `codigo_pozo_original`,
  `b`.`codigo_pozo_normalizado` AS `codigo_pozo_normalizado`,
  `b`.`marca` AS `marca`,
  `b`.`modelo` AS `modelo`,
  `b`.`serial` AS `serial`,
  `b`.`fecha_instalacion` AS `fecha_instalacion`,
  `b`.`fecha_falla` AS `fecha_falla`,
  `b`.`tvu_dias` AS `tvu_dias`,
  `b`.`estatus` AS `estatus`,
  `b`.`observaciones` AS `observaciones`,
  `b`.`raw_payload` AS `raw_payload`,
  `b`.`created_at` AS `created_at`
FROM `stg_firestore_bombas` `b`
JOIN (
  SELECT
    `codigo_pozo_normalizado`,
    MAX(
      CASE
        WHEN `fecha_instalacion` IS NOT NULL AND `fecha_instalacion` <> ''
          THEN STR_TO_DATE(`fecha_instalacion`, '%Y-%m-%d %H:%i:%s')
        ELSE NULL
      END
    ) AS `max_fecha_instalacion`
  FROM `stg_firestore_bombas`
  WHERE `codigo_pozo_normalizado` IS NOT NULL
    AND `codigo_pozo_normalizado` <> ''
  GROUP BY `codigo_pozo_normalizado`
) `ult`
  ON `ult`.`codigo_pozo_normalizado` = `b`.`codigo_pozo_normalizado`
 AND STR_TO_DATE(`b`.`fecha_instalacion`, '%Y-%m-%d %H:%i:%s') = `ult`.`max_fecha_instalacion`;

CREATE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `vw_stg_mapa_normalizado` AS
SELECT
  `s`.`id` AS `id`,
  `s`.`lote_carga` AS `lote_carga`,
  `s`.`origen_archivo` AS `origen_archivo`,
  `s`.`firestore_doc_id` AS `firestore_doc_id`,
  `s`.`codigo_pozo_original` AS `codigo_pozo_original`,
  `s`.`codigo_pozo_normalizado` AS `codigo_pozo_normalizado`,
  `s`.`categoria_original` AS `categoria_original`,
  `s`.`estado_original` AS `estado_original`,
  `s`.`area` AS `area`,
  `s`.`yacimiento` AS `yacimiento`,
  `s`.`potencial` AS `potencial`,
  `s`.`latitud` AS `latitud`,
  `s`.`longitud` AS `longitud`,
  `s`.`alto_corte_agua` AS `alto_corte_agua`,
  `s`.`nota_operativa` AS `nota_operativa`,
  `s`.`cabezal_nombre` AS `cabezal_nombre`,
  `s`.`vdf_nombre` AS `vdf_nombre`,
  `s`.`metodo_levantamiento` AS `metodo_levantamiento`,
  `s`.`fecha_arranque` AS `fecha_arranque`,
  `s`.`velocidad_operacional` AS `velocidad_operacional`,
  `s`.`velocidad_actual` AS `velocidad_actual`,
  `s`.`diagrama` AS `diagrama`,
  `s`.`coord_x` AS `coord_x`,
  `s`.`coord_y` AS `coord_y`,
  `s`.`visible_diagrama` AS `visible_diagrama`,
  `s`.`raw_payload` AS `raw_payload`,
  `s`.`created_at` AS `created_at`,
  CASE
    WHEN LCASE(TRIM(`s`.`estado_original`)) = 'activo' THEN 'Activo'
    WHEN LCASE(TRIM(`s`.`estado_original`)) = 'candidato' THEN 'Candidato'
    WHEN LCASE(TRIM(`s`.`estado_original`)) = 'diferido' THEN 'Diferido'
    WHEN LCASE(TRIM(`s`.`estado_original`)) = 'en-servicio' THEN 'En servicio'
    WHEN LCASE(TRIM(`s`.`estado_original`)) = 'inactivo-servicio' THEN 'Inactivo en espera por servicio'
    WHEN LCASE(TRIM(`s`.`estado_original`)) = 'diagnostico' THEN 'En diagnóstico'
    ELSE 'Activo'
  END AS `estado_normalizado`,
  CASE
    WHEN TRIM(COALESCE(`s`.`categoria_original`, '')) IN ('1','2','3')
      THEN TRIM(`s`.`categoria_original`)
    ELSE '1'
  END AS `categoria_normalizada`,
  CASE
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'altan' THEN 'Altan'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'baker-hughes' THEN 'Baker Hughes'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'cavallino' THEN 'Cavallino'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'combest' THEN 'Combest'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'hebei jerry' THEN 'Hebei Jerry'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'kudu' THEN 'Kudu'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'netzsch' THEN 'Netzsch'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'nov' THEN 'NOV'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'pcm' THEN 'PCM'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'tiger' THEN 'Tiger'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'weatherford' THEN 'Weatherford'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'lifteq' THEN 'Lifteq'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'vipower' THEN 'Vipower'
    WHEN LCASE(TRIM(`s`.`cabezal_nombre`)) = 'api' THEN 'Al Pro International'
    ELSE NULL
  END AS `cabezal_normalizado`,
  CASE
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'abb' THEN 'ABB'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'altan' THEN 'ALTAN'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'combest' THEN 'Combest'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'delta' THEN 'Delta'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'hebei jerry' THEN 'Hebei Jerry'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'matin dustrie' THEN 'Matin Dustrie'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'usfull' THEN 'Usfull'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'wg' THEN 'WG'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'wsc' THEN 'WSC'
    WHEN LCASE(TRIM(`s`.`vdf_nombre`)) = 'yaskawa' THEN 'Yaskawa'
    ELSE NULL
  END AS `vdf_normalizado`,
  COALESCE(NULLIF(TRIM(`s`.`area`), ''), 'SIN INFORMACION') AS `area_normalizada`
FROM `stg_firestore_mapa` AS `s`;

CREATE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `vw_stg_pdt_vigente` AS
SELECT
  `p`.`id` AS `id`,
  `p`.`lote_carga` AS `lote_carga`,
  `p`.`origen_archivo` AS `origen_archivo`,
  `p`.`firestore_doc_id` AS `firestore_doc_id`,
  `p`.`codigo_pozo_original` AS `codigo_pozo_original`,
  `p`.`codigo_pozo_normalizado` AS `codigo_pozo_normalizado`,
  `p`.`fecha_ultima_prueba` AS `fecha_ultima_prueba`,
  `p`.`volumetria` AS `volumetria`,
  `p`.`ays` AS `ays`,
  `p`.`rgp` AS `rgp`,
  `p`.`api` AS `api`,
  `p`.`bbpd` AS `bbpd`,
  `p`.`bnpd` AS `bnpd`,
  `p`.`yacimiento` AS `yacimiento`,
  `p`.`causa_diferido` AS `causa_diferido`,
  `p`.`condiciones_prueba` AS `condiciones_prueba`,
  `p`.`observaciones` AS `observaciones`,
  `p`.`raw_payload` AS `raw_payload`,
  `p`.`created_at` AS `created_at`
FROM `stg_firestore_pdt` `p`
JOIN (
  SELECT
    `codigo_pozo_normalizado`,
    MAX(
      CASE
        WHEN `fecha_ultima_prueba` IS NOT NULL AND `fecha_ultima_prueba` <> ''
          THEN STR_TO_DATE(`fecha_ultima_prueba`, '%Y-%m-%d %H:%i:%s')
        ELSE NULL
      END
    ) AS `max_fecha_ultima_prueba`
  FROM `stg_firestore_pdt`
  WHERE `codigo_pozo_normalizado` IS NOT NULL
    AND `codigo_pozo_normalizado` <> ''
  GROUP BY `codigo_pozo_normalizado`
) `ult`
  ON `ult`.`codigo_pozo_normalizado` = `p`.`codigo_pozo_normalizado`
 AND STR_TO_DATE(`p`.`fecha_ultima_prueba`, '%Y-%m-%d %H:%i:%s') = `ult`.`max_fecha_ultima_prueba`;

CREATE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `vw_stg_pozos_consolidado` AS
SELECT
  `pm`.`codigo_original` AS `codigo_original`,
  `pm`.`codigo_normalizado` AS `codigo_normalizado`,
  COALESCE(`pm`.`yacimiento`, 'SIN INFORMACION') AS `yacimiento`,
  COALESCE(`pv`.`fecha_ultima_prueba`, 'SIN INFORMACION') AS `pdt_fecha_ultima_prueba`,
  COALESCE(`pv`.`volumetria`, 'SIN INFORMACION') AS `pdt_volumetria`,
  COALESCE(`pv`.`ays`, 'SIN INFORMACION') AS `pdt_ays`,
  COALESCE(`pv`.`causa_diferido`, 'SIN INFORMACION') AS `pdt_causa_diferido`,
  COALESCE(`ba`.`marca`, 'SIN INFORMACION') AS `bomba_marca`,
  COALESCE(`ba`.`modelo`, 'SIN INFORMACION') AS `bomba_modelo`,
  COALESCE(`ba`.`fecha_instalacion`, 'SIN INFORMACION') AS `bomba_fecha_instalacion`,
  COALESCE(`ba`.`tvu_dias`, 'SIN INFORMACION') AS `bomba_tvu_dias`,
  COALESCE(`ba`.`estatus`, 'SIN INFORMACION') AS `bomba_estatus`,
  COALESCE(`ba`.`observaciones`, 'SIN INFORMACION') AS `bomba_observaciones`
FROM `stg_pozos_master` `pm`
LEFT JOIN `vw_stg_pdt_vigente` `pv`
  ON `pv`.`codigo_pozo_normalizado` = `pm`.`codigo_normalizado`
LEFT JOIN `vw_stg_bomba_actual` `ba`
  ON `ba`.`codigo_pozo_normalizado` = `pm`.`codigo_normalizado`;

CREATE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW `vw_stg_pozos_match` AS
SELECT
  `p`.`id` AS `id_pozo`,
  `p`.`codigo` AS `codigo_pozo`,
  `s`.`codigo_original` AS `codigo_original`,
  `s`.`codigo_normalizado` AS `codigo_normalizado`,
  `s`.`yacimiento` AS `yacimiento`
FROM `stg_pozos_master` `s`
JOIN `pozos` `p`
  ON `p`.`codigo` = `s`.`codigo_normalizado`;