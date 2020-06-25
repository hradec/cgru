<?php

$var_value = $_GET['f'];



$cmd="./convert.py $var_value";
$ret=exec($cmd);
$size = getimagesize($ret);

//$im=file_get_contents($ret);
/*

// send the right headers
header('Content-Type: '.$size['mime']);
header('Content-Length: '.filesize($ret));

// dump the picture and stop the script
readfile($ret);
//exit;
*/

// Set the content type header - in this case image/jpg
header('Content-Type: image/jpeg', TRUE);
//header('Content-Length: '.filesize($ret));


if(0){ 
    // Get image from file
    $img = imagecreatefromjpeg($ret);
 
    // Output the image
    imagejpeg($img, NULL, 75);
    imagedestroy($img);
}else{
    readfile($ret);
}

if (strpos($ret, '/dev/shm/') !== false) {
    exec('rm -rf ' . $ret . " & ");
}
exit;
?>
